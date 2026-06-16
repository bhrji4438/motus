import type { ITenantRepository } from '@motus/core';
import type { Tenant, TenantId } from '@motus/types';
import type { RedisClient } from '@/client/RedisClientManager.js';
import { KeyFactory } from '@/keys/KeyFactory.js';
import { TenantGuard } from '@/guards/TenantGuard.js';
import { TenantSerializer } from '@/serialization/Serializer.js';
import {
  resolveObservability,
  withObservability,
  type RedisObservabilityDeps,
} from '@/observability/RedisObservability.js';

/**
 * Redis-backed implementation of ITenantRepository.
 *
 * Storage: Hash at `tenant:{tenantId}:config`
 * Slot:    {tenantId} hashtag — co-located with all other tenant keys.
 */
export class RedisTenantRepository implements ITenantRepository {
  private readonly obs;

  constructor(
    private readonly client: RedisClient,
    deps?: RedisObservabilityDeps
  ) {
    this.obs = resolveObservability(deps);
  }

  async save(tenant: Tenant): Promise<void> {
    TenantGuard.validate(tenant.id);
    const key = KeyFactory.tenantHash(tenant.id);
    const fields = TenantSerializer.serialize(tenant);

    await withObservability(this.obs, 'RedisTenantRepository.save', async () => {
      const args: string[] = [];
      for (const [f, v] of Object.entries(fields)) {
        args.push(f, v);
      }
      await (this.client as any).hset(key, ...args);
    });

    this.obs.logger.debug(`Tenant saved`, { key, tenantId: tenant.id });
  }

  async get(tenantId: TenantId): Promise<Tenant | null> {
    TenantGuard.validate(tenantId);
    const key = KeyFactory.tenantHash(tenantId);

    return withObservability(this.obs, 'RedisTenantRepository.get', async () => {
      const fields = await (this.client as any).hgetall(key) as Record<string, string> | null;
      if (!fields || Object.keys(fields).length === 0) {
        this.obs.metrics.incrementCacheMiss('RedisTenantRepository');
        this.obs.logger.debug(`Tenant not found`, { key, tenantId });
        return null;
      }
      this.obs.metrics.incrementCacheHit('RedisTenantRepository');
      return TenantSerializer.deserialize(fields);
    });
  }
}
