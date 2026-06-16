import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startRedisTestContainer, flushTestRedis, type RedisTestContext } from '@/__tests__/helpers/RedisTestContainer.js';
import { RedisTenantRepository } from '@/repositories/RedisTenantRepository.js';

const makeTenant = () => ({
  id: 'tnt_test',
  name: 'Test Tenant',
  matchingConfig: {
    strategy: 'DISTANCE' as any,
    maxSearchRadius: { value: 5000, unit: 'METERS' as any },
    maxCandidatesPerWave: 5,
  },
  fanoutConfig: {
    mode: 'PARALLEL' as any,
    intervalSeconds: 5,
  },
  retryPolicy: {
    maxWaves: 5,
    waveTimeoutSeconds: 30,
    reEvaluationDelaySeconds: 10,
  },
  zones: [],
});

describe('RedisTenantRepository (integration)', () => {
  let ctx: RedisTestContext;
  let repo: RedisTenantRepository;

  beforeAll(async () => {
    ctx = await startRedisTestContainer();
    repo = new RedisTenantRepository(ctx.client);
  });

  afterAll(async () => {
    await ctx.manager.disconnect();
    await ctx.container.stop();
  });

  beforeEach(async () => {
    await flushTestRedis(ctx.client);
  });

  it('saves and retrieves a tenant', async () => {
    const tenant = makeTenant();
    await repo.save(tenant);
    const result = await repo.get('tnt_test');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('tnt_test');
    expect(result!.name).toBe('Test Tenant');
  });

  it('returns null for non-existent tenant', async () => {
    const result = await repo.get('tnt_nonexistent');
    expect(result).toBeNull();
  });

  it('overwrites an existing tenant on re-save', async () => {
    const tenant = makeTenant();
    await repo.save(tenant);
    await repo.save({ ...tenant, name: 'Updated Name' });
    const result = await repo.get('tnt_test');
    expect(result!.name).toBe('Updated Name');
  });

  it('preserves complex JSON config fields', async () => {
    const tenant = makeTenant();
    await repo.save(tenant);
    const result = await repo.get('tnt_test');
    expect(result!.matchingConfig.maxSearchRadius.value).toBe(5000);
    expect(result!.matchingConfig.maxCandidatesPerWave).toBe(5);
  });
});
