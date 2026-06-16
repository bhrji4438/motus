import type { TenantId, DriverId } from '@motus/types';
import type { RedisClient } from '@/client/RedisClientManager.js';
import { KeyFactory } from '@/keys/KeyFactory.js';
import { TenantGuard } from '@/guards/TenantGuard.js';
import {
  resolveObservability,
  withObservability,
  type RedisObservabilityDeps,
} from '@/observability/RedisObservability.js';

export interface PresenceEntry {
  driverId: DriverId;
  lastHeartbeatMs: number;
}

/**
 * Tracks active driver presence via a Redis Sorted Set scored by heartbeat timestamp.
 *
 * Owned structure: `tenant:{tenantId}:presence:active`
 * Score: Unix timestamp in ms of last heartbeat.
 *
 * Written by: RedisDriverRepository (via saveDriverAtomic Lua) and this class.
 * Read by:    This class, RedisCleanupService (stale presence worker).
 */
export class RedisPresenceRepository {
  private readonly obs;

  constructor(
    private readonly client: RedisClient,
    deps?: RedisObservabilityDeps
  ) {
    this.obs = resolveObservability(deps);
  }

  /** Updates the heartbeat score for a driver. */
  async heartbeat(tenantId: TenantId, driverId: DriverId, timestampMs?: number): Promise<void> {
    TenantGuard.validate(tenantId);
    TenantGuard.validateDriverId(driverId);
    const key = KeyFactory.driverPresenceZset(tenantId);
    const score = timestampMs ?? Date.now();

    await withObservability(this.obs, 'RedisPresenceRepository.heartbeat', async () => {
      await (this.client as any).zadd(key, score, driverId);
    });
  }

  /** Removes a driver from the presence set (offline or cleanup). */
  async remove(tenantId: TenantId, driverId: DriverId): Promise<void> {
    TenantGuard.validate(tenantId);
    TenantGuard.validateDriverId(driverId);
    const key = KeyFactory.driverPresenceZset(tenantId);

    await withObservability(this.obs, 'RedisPresenceRepository.remove', async () => {
      await (this.client as any).zrem(key, driverId);
    });
  }

  /**
   * Returns drivers whose last heartbeat is older than the given threshold.
   * Score range: [-inf, (now - staleThresholdMs)]
   */
  async getStaleDrivers(
    tenantId: TenantId,
    staleThresholdMs: number,
    limit = 100
  ): Promise<PresenceEntry[]> {
    TenantGuard.validate(tenantId);
    const key = KeyFactory.driverPresenceZset(tenantId);
    const cutoffScore = Date.now() - staleThresholdMs;

    return withObservability(this.obs, 'RedisPresenceRepository.getStaleDrivers', async () => {
      const results = await (this.client as any).zrangebyscore(
        key, '-inf', cutoffScore, 'WITHSCORES', 'LIMIT', 0, limit
      ) as string[];

      const entries: PresenceEntry[] = [];
      for (let i = 0; i < results.length; i += 2) {
        entries.push({
          driverId: results[i] as DriverId,
          lastHeartbeatMs: parseInt(results[i + 1], 10),
        });
      }
      return entries;
    });
  }

  /** Returns all active presence entries for a tenant. */
  async getActiveDrivers(tenantId: TenantId): Promise<PresenceEntry[]> {
    TenantGuard.validate(tenantId);
    const key = KeyFactory.driverPresenceZset(tenantId);

    return withObservability(this.obs, 'RedisPresenceRepository.getActiveDrivers', async () => {
      const results = await (this.client as any).zrangebyscore(
        key, '-inf', '+inf', 'WITHSCORES'
      ) as string[];

      const entries: PresenceEntry[] = [];
      for (let i = 0; i < results.length; i += 2) {
        entries.push({
          driverId: results[i] as DriverId,
          lastHeartbeatMs: parseInt(results[i + 1], 10),
        });
      }
      return entries;
    });
  }

  /** Returns the heartbeat timestamp for a specific driver, or null if absent. */
  async getHeartbeat(tenantId: TenantId, driverId: DriverId): Promise<number | null> {
    TenantGuard.validate(tenantId);
    TenantGuard.validateDriverId(driverId);
    const key = KeyFactory.driverPresenceZset(tenantId);

    return withObservability(this.obs, 'RedisPresenceRepository.getHeartbeat', async () => {
      const score = await (this.client as any).zscore(key, driverId) as string | null;
      return score !== null ? parseInt(score, 10) : null;
    });
  }

  /** Returns the count of currently active drivers in the presence ZSET. */
  async count(tenantId: TenantId): Promise<number> {
    TenantGuard.validate(tenantId);
    const key = KeyFactory.driverPresenceZset(tenantId);
    return withObservability(this.obs, 'RedisPresenceRepository.count', async () => {
      return (this.client as any).zcard(key) as Promise<number>;
    });
  }
}
