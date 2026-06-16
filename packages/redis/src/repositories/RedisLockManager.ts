import { randomUUID } from "crypto";
import type { ILockManager } from "@motus/core";
import type { RedisClient } from "@/client/RedisClientManager.js";
import { KeyFactory } from "@/keys/KeyFactory.js";
import type { RedisLockConfig } from "@/config/index.js";
import { DEFAULT_LOCK_CONFIG } from "@/config/index.js";
import {
  resolveObservability,
  withObservability,
  type RedisObservabilityDeps,
} from "@/observability/RedisObservability.js";

export interface LockHandle {
  key: string;
  ownerToken: string;
  ttlMs: number;
  renewalIntervalId?: ReturnType<typeof setInterval>;
}

/**
 * Redis-backed distributed lock manager.
 *
 * Implements ILockManager from @motus/core.
 *
 * Lock structure:
 *   Key:   lock:{resourceId}
 *   Value: ownerToken (UUID v4)
 *   TTL:   configured per lock type
 *
 * All lock operations use Lua scripts registered by LuaScriptRegistry
 * to guarantee atomic SET NX PX, owner-verified DEL, and owner-verified PEXPIRE.
 */
export class RedisLockManager implements ILockManager {
  private readonly obs;
  private readonly lockConfig: RedisLockConfig;

  constructor(
    private readonly client: RedisClient,
    lockConfig: RedisLockConfig = DEFAULT_LOCK_CONFIG,
    deps?: RedisObservabilityDeps
  ) {
    this.obs = resolveObservability(deps);
    this.lockConfig = lockConfig;
  }

  /**
   * Attempts a single lock acquisition — implements ILockManager.acquireLock.
   * @param key       The resource identifier (will be namespaced under lock:)
   * @param ttlSeconds TTL in seconds. Defaults to defaultLockTtlMs/1000 if omitted.
   * Returns true if acquired, false if already held.
   */
  async acquireLock(key: string, ttlSeconds?: number): Promise<boolean> {
    const lockKey = KeyFactory.lock(key);
    const ttlMs =
      ttlSeconds !== undefined
        ? ttlSeconds * 1000
        : this.lockConfig.defaultLockTtlMs;
    return this.attemptAcquire(lockKey, ttlMs);
  }

  /**
   * Releases a lock by key — implements ILockManager.releaseLock.
   * Best-effort DEL (no owner verification at this level; use releaseLockHandle for verified release).
   */
  async releaseLock(key: string): Promise<void> {
    const lockKey = KeyFactory.lock(key);
    await withObservability(
      this.obs,
      "RedisLockManager.releaseLock",
      async () => {
        await (this.client as any).del(lockKey);
      }
    );
  }

  /**
   * Acquires a lock with a full handle, supporting owner-verified release and renewal.
   * Retries up to lockConfig.retryMaxAttempts times with exponential backoff + jitter.
   */
  async acquireLockWithHandle(
    resourceId: string,
    ttlMs?: number
  ): Promise<LockHandle | null> {
    const key = KeyFactory.lock(resourceId);
    const resolvedTtl = ttlMs ?? this.lockConfig.defaultLockTtlMs;
    const ownerToken = randomUUID();

    for (
      let attempt = 1;
      attempt <= this.lockConfig.retryMaxAttempts;
      attempt++
    ) {
      const acquired = await this.attemptAcquireWithToken(
        key,
        ownerToken,
        resolvedTtl
      );
      if (acquired) {
        this.obs.metrics.incrementLockAcquisition(key);
        this.obs.logger.debug(`Lock acquired`, {
          key,
          ownerToken,
          ttlMs: resolvedTtl,
          attempt,
        });
        return { key, ownerToken, ttlMs: resolvedTtl };
      }

      this.obs.metrics.incrementLockContention(key);
      this.obs.logger.debug(`Lock contention`, {
        key,
        attempt,
        maxAttempts: this.lockConfig.retryMaxAttempts,
      });

      if (attempt < this.lockConfig.retryMaxAttempts) {
        const delay =
          this.lockConfig.retryDelayMs *
            Math.pow(this.lockConfig.retryBackoffFactor, attempt - 1) +
          Math.random() * this.lockConfig.retryJitterMs;
        await new Promise((r) => setTimeout(r, Math.round(delay)));
      }
    }

    this.obs.logger.warn(
      `Lock acquisition failed after ${this.lockConfig.retryMaxAttempts} attempts`,
      { key }
    );
    return null;
  }

  /** Releases a lock using the owner token from the handle. */
  async releaseLockHandle(handle: LockHandle): Promise<void> {
    if (handle.renewalIntervalId) {
      clearInterval(handle.renewalIntervalId);
    }
    await withObservability(
      this.obs,
      "RedisLockManager.releaseLockHandle",
      async () => {
        const result = (await (this.client as any).motusReleaseLock(
          handle.key,
          handle.ownerToken
        )) as number;
        if (result === 0) {
          this.obs.logger.warn(
            `Lock release failed: owner mismatch or expired`,
            {
              key: handle.key,
              ownerToken: handle.ownerToken,
            }
          );
        } else {
          this.obs.logger.debug(`Lock released`, { key: handle.key });
        }
      }
    );
  }

  /**
   * Starts automatic lock renewal at TTL/2 intervals.
   * The handle is mutated to hold the interval ID.
   * Call releaseLockHandle to stop renewal and release.
   */
  startRenewal(handle: LockHandle): void {
    const renewalIntervalMs = Math.floor(
      handle.ttlMs * this.lockConfig.renewalThreshold
    );
    handle.renewalIntervalId = setInterval(async () => {
      try {
        const result = (await (this.client as any).motusRenewLock(
          handle.key,
          handle.ownerToken,
          handle.ttlMs
        )) as number;
        if (result === 0) {
          this.obs.logger.warn(
            `Lock renewal failed: token mismatch or expired`,
            {
              key: handle.key,
            }
          );
          clearInterval(handle.renewalIntervalId);
        } else {
          this.obs.logger.debug(`Lock renewed`, {
            key: handle.key,
            ttlMs: handle.ttlMs,
          });
        }
      } catch (err) {
        this.obs.logger.error(`Lock renewal error`, {
          key: handle.key,
          error: err,
        });
        clearInterval(handle.renewalIntervalId);
      }
    }, renewalIntervalMs);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async attemptAcquire(key: string, ttlMs: number): Promise<boolean> {
    const ownerToken = randomUUID();
    return this.attemptAcquireWithToken(key, ownerToken, ttlMs);
  }

  private async attemptAcquireWithToken(
    key: string,
    ownerToken: string,
    ttlMs: number
  ): Promise<boolean> {
    return withObservability(
      this.obs,
      "RedisLockManager.attemptAcquire",
      async () => {
        const result = (await (this.client as any).motusAcquireLock(
          key,
          ownerToken,
          String(ttlMs)
        )) as number;
        return result === 1;
      }
    );
  }
}
