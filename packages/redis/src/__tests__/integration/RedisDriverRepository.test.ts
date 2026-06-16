import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startRedisTestContainer, flushTestRedis, type RedisTestContext } from '@/__tests__/helpers/RedisTestContainer.js';
import { RedisDriverRepository } from '@/repositories/RedisDriverRepository.js';
import type { Driver } from '@motus/types';
import { KeyFactory } from '@/keys/KeyFactory.js';
import { DriverSerializer } from '@/serialization/Serializer.js';

const makeDriver = (overrides?: Partial<Driver & { vehicleType: string }>): Driver & { vehicleType: string } => ({
  id: 'drv_001',
  tenantId: 'tnt_abc',
  status: 'ONLINE' as any,
  location: {
    latitude: 28.6139,
    longitude: 77.2090,
    timestamp: new Date().toISOString(),
    bearing: 90,
    speed: 30,
    accuracy: 5,
  } as any,
  currentLoad: 1,
  capacity: 3,
  lastHeartbeat: new Date().toISOString(),
  vehicleType: 'CAR',
  ...overrides,
});

describe('RedisDriverRepository (integration)', () => {
  let ctx: RedisTestContext;
  let repo: RedisDriverRepository;

  beforeAll(async () => {
    ctx = await startRedisTestContainer();
    repo = new RedisDriverRepository(ctx.client);
  });

  afterAll(async () => {
    await ctx.manager.disconnect();
    await ctx.container.stop();
  });

  beforeEach(async () => {
    await flushTestRedis(ctx.client);
  });

  it('saves and retrieves a driver', async () => {
    const driver = makeDriver();
    await repo.save(driver);
    const result = await repo.get('tnt_abc', 'drv_001');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('drv_001');
    expect(result!.status).toBe('ONLINE');
    expect((result as any).vehicleType).toBe('CAR');
  });

  it('returns null for non-existent driver', async () => {
    const result = await repo.get('tnt_abc', 'drv_nonexistent');
    expect(result).toBeNull();
  });

  it('updates driver location', async () => {
    const driver = makeDriver();
    await repo.save(driver);

    const newLocation = {
      latitude: 28.7,
      longitude: 77.3,
      timestamp: new Date().toISOString(),
    } as any;
    await repo.updateLocation('tnt_abc', 'drv_001', newLocation);

    const result = await repo.get('tnt_abc', 'drv_001');
    expect(result!.location.latitude).toBeCloseTo(28.7, 3);
    expect(result!.location.longitude).toBeCloseTo(77.3, 3);
  });

  it('sets driver status', async () => {
    await repo.save(makeDriver());
    await repo.setDriverStatus('tnt_abc', 'drv_001', 'OFFLINE' as any);
    const result = await repo.get('tnt_abc', 'drv_001');
    expect(result!.status).toBe('OFFLINE');
  });

  it('finds nearby drivers within radius', async () => {
    // Save a driver at a known location
    await repo.save(makeDriver({
      id: 'drv_nearby',
      location: {
        latitude: 28.6140,
        longitude: 77.2091,
        timestamp: new Date().toISOString(),
      } as any,
    }));

    // Search from 28.6139, 77.2090 with 1000m radius
    const results = await repo.findNearbyDrivers(
      'tnt_abc',
      { latitude: 28.6139, longitude: 77.2090 },
      1000,
      10
    );

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('drv_nearby');
  });

  it('does not return drivers outside radius', async () => {
    // Save a driver far away (New York approx)
    await repo.save(makeDriver({
      id: 'drv_far',
      location: {
        latitude: 40.7128,
        longitude: -74.0060,
        timestamp: new Date().toISOString(),
      } as any,
    }));

    // Search from Delhi with 1000m radius
    const results = await repo.findNearbyDrivers(
      'tnt_abc',
      { latitude: 28.6139, longitude: 77.2090 },
      1000,
      10
    );

    expect(results.map(d => d.id)).not.toContain('drv_far');
  });

  it('rejects cross-tenant access', async () => {
    const driver = makeDriver({ tenantId: 'tnt_abc' });
    const fields = DriverSerializer.serialize(driver);
    await ctx.client.hset(KeyFactory.driverHash('tnt_OTHER', driver.id), fields);

    // Try to fetch driver from a different tenant
    await expect(repo.get('tnt_OTHER', 'drv_001')).rejects.toThrow('MOTUS_UNAUTHORIZED');
  });
});
