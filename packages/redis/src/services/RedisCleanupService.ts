import type { TenantId } from "@motus/types";
import type { RedisClient } from "@/client/RedisClientManager.js";
import { KeyFactory } from "@/keys/KeyFactory.js";
import {
  RedisLockManager,
  type LockHandle,
} from "@/repositories/RedisLockManager.js";
import { RedisGeoRepository } from "@/repositories/RedisGeoRepository.js";
import { RedisPresenceRepository } from "@/repositories/RedisPresenceRepository.js";
import type {
  RedisCleanupConfig,
  RedisLockConfig,
  RedisRetentionConfig,
} from "@/config/index.js";
import {
  DEFAULT_CLEANUP_CONFIG,
  DEFAULT_LOCK_CONFIG,
  DEFAULT_RETENTION_CONFIG,
} from "@/config/index.js";
import {
  resolveObservability,
  type RedisObservabilityDeps,
} from "@/observability/RedisObservability.js";

/**
 * Cleanup service running five periodic background workers:
 *
 * 1. Session Expiry Pruner    — prunes terminal sessions from Redis
 * 2. Telemetry Retention      — trims telemetry streams to maxLen
 * 3. Event Retention          — trims event streams to maxLen
 * 4. Presence Cleanup         — removes stale drivers from presence ZSET and geo-index
 * 5. Lock Janitor             — detects and removes unexpected persistent lock keys
 *
 * Each worker acquires a distributed lock before executing to ensure only one
 * cluster node runs cleanup at a time. Workers are non-overlapping within a
 * single node (lock prevents concurrent execution).
 */
export class RedisCleanupService {
  private readonly obs;
  private readonly intervalIds: ReturnType<typeof setInterval>[] = [];
  private readonly lockManager: RedisLockManager;
  private readonly geoRepo: RedisGeoRepository;
  private readonly presenceRepo: RedisPresenceRepository;

  constructor(
    private readonly client: RedisClient,
    private readonly cleanup: RedisCleanupConfig = DEFAULT_CLEANUP_CONFIG,
    private readonly retention: RedisRetentionConfig = DEFAULT_RETENTION_CONFIG,
    lockConfig: RedisLockConfig = DEFAULT_LOCK_CONFIG,
    deps?: RedisObservabilityDeps
  ) {
    this.obs = resolveObservability(deps);
    this.lockManager = new RedisLockManager(client, lockConfig, deps);
    this.geoRepo = new RedisGeoRepository(client, deps);
    this.presenceRepo = new RedisPresenceRepository(client, deps);
  }

  /** Starts all enabled cleanup workers. */
  start(): void {
    if (!this.cleanup.enabled) {
      this.obs.logger.info(
        "RedisCleanupService: disabled by config, no workers started"
      );
      return;
    }

    this.scheduleWorker(
      "SessionExpiryPruner",
      this.cleanup.sessionExpiryIntervalSeconds * 1000,
      () => this.runSessionExpiryPruner()
    );

    this.scheduleWorker(
      "TelemetryRetention",
      this.cleanup.telemetryRetentionIntervalSeconds * 1000,
      () => this.runTelemetryRetention()
    );

    this.scheduleWorker(
      "EventRetention",
      this.cleanup.eventRetentionIntervalSeconds * 1000,
      () => this.runEventRetention()
    );

    this.scheduleWorker(
      "LockJanitor",
      this.cleanup.lockJanitorIntervalSeconds * 1000,
      () => this.runLockJanitor()
    );

    this.obs.logger.info("RedisCleanupService: all workers started");
  }

  /** Starts presence cleanup for a specific tenant. Call once per tenant. */
  startPresenceCleanup(tenantId: TenantId): void {
    if (!this.cleanup.enabled) return;
    this.scheduleWorker(
      `PresenceCleanup:${tenantId}`,
      this.cleanup.presenceCleanupIntervalSeconds * 1000,
      () => this.runPresenceCleanup(tenantId)
    );
  }

  /** Stops all workers and clears all intervals. */
  stop(): void {
    for (const id of this.intervalIds) {
      clearInterval(id);
    }
    this.intervalIds.length = 0;
    this.obs.logger.info("RedisCleanupService: all workers stopped");
  }

  // ─── Worker 1: Session Expiry Pruner ─────────────────────────────────────

  async runSessionExpiryPruner(): Promise<void> {
    const lock = await this.acquireWorkerLock(
      KeyFactory.cleanupSessionExpiryLock()
    );
    if (!lock) return;

    try {
      const now = Date.now();
      const members = (await (this.client as any).motusExpireSessionScan(
        KeyFactory.sessionExpiryZset(),
        String(now),
        String(this.cleanup.cleanupBatchSize)
      )) as string[];

      if (!members || members.length === 0) return;

      this.obs.logger.info(
        `SessionExpiryPruner: pruning ${members.length} expired sessions`
      );

      for (const member of members) {
        const parsed = KeyFactory.parseExpiryMember(member);
        if (!parsed) continue;

        const { tenantId, sessionId } = parsed;
        try {
          // Prune session data (3 tenant-scoped keys via Lua)
          await (this.client as any).motusPruneSessionData(
            KeyFactory.sessionHash(tenantId, sessionId),
            KeyFactory.sessionTelemetryStream(tenantId, sessionId),
            KeyFactory.sessionEventStream(tenantId, sessionId)
          );

          // Remove from global expiry ZSET (separate single-key operation)
          await (this.client as any).zrem(
            KeyFactory.sessionExpiryZset(),
            member
          );

          this.obs.metrics.recordCleanupPruned("session", 1);
          this.obs.logger.debug(`Pruned session`, { tenantId, sessionId });
        } catch (err) {
          this.obs.logger.error(`Failed to prune session`, {
            tenantId,
            sessionId,
            error: err,
          });
        }
      }
    } finally {
      await this.lockManager.releaseLockHandle(lock);
    }
  }

  // ─── Worker 2: Telemetry Retention ───────────────────────────────────────

  async runTelemetryRetention(): Promise<void> {
    const lock = await this.acquireWorkerLock(
      KeyFactory.cleanupTelemetryLock()
    );
    if (!lock) return;

    try {
      // Get active sessions from expiry ZSET (all members, not just expired)
      const members = (await (this.client as any).zrangebyscore(
        KeyFactory.sessionExpiryZset(),
        "-inf",
        "+inf",
        "LIMIT",
        0,
        this.cleanup.cleanupBatchSize
      )) as string[];

      for (const member of members) {
        const parsed = KeyFactory.parseExpiryMember(member);
        if (!parsed) continue;
        const { tenantId, sessionId } = parsed;
        try {
          await (this.client as any).xtrim(
            KeyFactory.sessionTelemetryStream(tenantId, sessionId),
            "MAXLEN",
            "~",
            this.retention.telemetryMaxPoints
          );
        } catch (err) {
          this.obs.logger.warn(`Telemetry trim failed`, {
            tenantId,
            sessionId,
            error: err,
          });
        }
      }

      this.obs.logger.debug(
        `TelemetryRetention: trimmed ${members.length} sessions`
      );
    } finally {
      await this.lockManager.releaseLockHandle(lock);
    }
  }

  // ─── Worker 3: Event Retention ────────────────────────────────────────────

  async runEventRetention(): Promise<void> {
    const lock = await this.acquireWorkerLock(KeyFactory.cleanupEventLock());
    if (!lock) return;

    try {
      const members = (await (this.client as any).zrangebyscore(
        KeyFactory.sessionExpiryZset(),
        "-inf",
        "+inf",
        "LIMIT",
        0,
        this.cleanup.cleanupBatchSize
      )) as string[];

      for (const member of members) {
        const parsed = KeyFactory.parseExpiryMember(member);
        if (!parsed) continue;
        const { tenantId, sessionId } = parsed;
        try {
          await (this.client as any).xtrim(
            KeyFactory.sessionEventStream(tenantId, sessionId),
            "MAXLEN",
            "~",
            this.retention.eventMaxEntries
          );
        } catch (err) {
          this.obs.logger.warn(`Event trim failed`, {
            tenantId,
            sessionId,
            error: err,
          });
        }
      }

      this.obs.logger.debug(
        `EventRetention: trimmed ${members.length} sessions`
      );
    } finally {
      await this.lockManager.releaseLockHandle(lock);
    }
  }

  // ─── Worker 4: Presence Cleanup ──────────────────────────────────────────

  async runPresenceCleanup(tenantId: TenantId): Promise<void> {
    const lock = await this.acquireWorkerLock(
      KeyFactory.cleanupPresenceLock(tenantId)
    );
    if (!lock) return;

    try {
      const staleThresholdMs = this.cleanup.staleDriverThresholdSeconds * 1000;
      const staleDrivers = await this.presenceRepo.getStaleDrivers(
        tenantId,
        staleThresholdMs,
        this.cleanup.cleanupBatchSize
      );

      if (staleDrivers.length === 0) return;

      this.obs.logger.info(
        `PresenceCleanup: removing ${staleDrivers.length} stale drivers`,
        { tenantId }
      );

      for (const { driverId, lastHeartbeatMs } of staleDrivers) {
        const staleAgeSeconds = Math.round(
          (Date.now() - lastHeartbeatMs) / 1000
        );
        try {
          await this.presenceRepo.remove(tenantId, driverId);
          await this.geoRepo.remove(tenantId, driverId);
          this.obs.logger.debug(`Removed stale driver from presence + geo`, {
            tenantId,
            driverId,
            staleAgeSeconds,
          });
        } catch (err) {
          this.obs.logger.error(`Failed to remove stale driver`, {
            tenantId,
            driverId,
            error: err,
          });
        }
      }
    } finally {
      await this.lockManager.releaseLockHandle(lock);
    }
  }

  // ─── Worker 5: Lock Janitor ───────────────────────────────────────────────

  async runLockJanitor(): Promise<void> {
    // No lock needed — this is an idempotent scan
    try {
      let cursor = "0";
      let persistentCount = 0;

      do {
        const [nextCursor, keys] = (await (this.client as any).scan(
          cursor,
          "MATCH",
          "lock:*",
          "COUNT",
          100
        )) as [string, string[]];
        cursor = nextCursor;

        for (const key of keys) {
          const ttl = (await (this.client as any).ttl(key)) as number;
          if (ttl === -1) {
            // Persistent key — this should never happen for lock keys
            this.obs.logger.warn(
              `LockJanitor: found persistent lock key without TTL`,
              { key }
            );
            await (this.client as any).del(key);
            persistentCount++;
          }
        }
      } while (cursor !== "0");

      if (persistentCount > 0) {
        this.obs.logger.warn(
          `LockJanitor: removed ${persistentCount} persistent lock keys`
        );
      } else {
        this.obs.logger.debug(`LockJanitor: no persistent lock keys found`);
      }
    } catch (err) {
      this.obs.logger.error(`LockJanitor failed`, { error: err });
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async acquireWorkerLock(lockKey: string): Promise<LockHandle | null> {
    const handle = await this.lockManager.acquireLockWithHandle(lockKey);
    if (!handle) {
      this.obs.logger.debug(`Worker lock not acquired (another node running)`, {
        lockKey,
      });
    }
    return handle;
  }

  private scheduleWorker(
    name: string,
    intervalMs: number,
    fn: () => Promise<void>
  ): void {
    const id = setInterval(() => {
      fn().catch((err) => {
        this.obs.logger.error(
          `Cleanup worker "${name}" threw an uncaught error`,
          { error: err }
        );
      });
    }, intervalMs);
    this.intervalIds.push(id);
    this.obs.logger.debug(`Cleanup worker scheduled`, { name, intervalMs });
  }
}
