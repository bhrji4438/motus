import type { IDriverRepository } from '@motus/core';
import type { Driver, TenantId, DriverId, Location, Coordinates, DriverStatus } from '@motus/types';
import type { RedisClient } from '@/client/RedisClientManager.js';
import { KeyFactory } from '@/keys/KeyFactory.js';
import { TenantGuard } from '@/guards/TenantGuard.js';
import { DriverSerializer } from '@/serialization/Serializer.js';
import {
  resolveObservability,
  withObservability,
  type RedisObservabilityDeps,
} from '@/observability/RedisObservability.js';

/**
 * Redis-backed implementation of IDriverRepository.
 *
 * Storage layout per driver:
 * - Hash:     `tenant:{tenantId}:driver:{driverId}` — full driver profile
 * - Geo:      `tenant:{tenantId}:drivers:geo`        — geospatial index
 * - Presence: `tenant:{tenantId}:presence:active`    — ZSET scored by heartbeat ms
 *
 * All three keys share the {tenantId} hash slot, enabling atomic Lua writes.
 */
export class RedisDriverRepository implements IDriverRepository {
  private readonly obs;

  constructor(
    private readonly client: RedisClient,
    deps?: RedisObservabilityDeps
  ) {
    this.obs = resolveObservability(deps);
  }

  async save(driver: Driver & { vehicleType?: string }): Promise<void> {
    TenantGuard.validate(driver.tenantId);
    TenantGuard.validateDriverId(driver.id);

    const hashKey = KeyFactory.driverHash(driver.tenantId, driver.id);
    const geoKey = KeyFactory.driverGeoIndex(driver.tenantId);
    const presenceKey = KeyFactory.driverPresenceZset(driver.tenantId);

    const fields = DriverSerializer.serialize(driver);
    const heartbeatScore = String(Date.now());

    // Build flat arg list for Lua script (field-value pairs + sentinel + geo + presence)
    const hmsetArgs: string[] = [];
    for (const [f, v] of Object.entries(fields)) {
      hmsetArgs.push(f, v);
    }
    hmsetArgs.push('___END___');
    hmsetArgs.push(
      String(driver.location.longitude),
      String(driver.location.latitude),
      driver.id,
      heartbeatScore,
      driver.id
    );

    await withObservability(this.obs, 'RedisDriverRepository.save', async () => {
      await (this.client as any).motusSaveDriverAtomic(
        hashKey, geoKey, presenceKey,
        ...hmsetArgs
      );
    });

    this.obs.logger.debug(`Driver saved`, {
      tenantId: driver.tenantId,
      driverId: driver.id,
      status: driver.status,
    });
  }

  async get(tenantId: TenantId, driverId: DriverId): Promise<Driver | null> {
    TenantGuard.validate(tenantId);
    TenantGuard.validateDriverId(driverId);
    const key = KeyFactory.driverHash(tenantId, driverId);

    return withObservability(this.obs, 'RedisDriverRepository.get', async () => {
      const fields = await (this.client as any).hgetall(key) as Record<string, string> | null;
      if (!fields || Object.keys(fields).length === 0) {
        this.obs.metrics.incrementCacheMiss('RedisDriverRepository');
        return null;
      }

      // Cross-tenant safeguard: verify stored tenantId matches requested tenantId
      if (fields['tenantId'] && fields['tenantId'] !== tenantId) {
        this.obs.logger.error(`Cross-tenant access detected`, {
          requestedTenantId: tenantId,
          storedTenantId: fields['tenantId'],
          driverId,
        });
        throw new Error(`MOTUS_UNAUTHORIZED: Cross-tenant driver access denied for driverId ${driverId}`);
      }

      this.obs.metrics.incrementCacheHit('RedisDriverRepository');
      return DriverSerializer.deserialize(fields);
    });
  }

  async updateLocation(tenantId: TenantId, driverId: DriverId, location: Location): Promise<void> {
    TenantGuard.validate(tenantId);
    TenantGuard.validateDriverId(driverId);

    const hashKey = KeyFactory.driverHash(tenantId, driverId);
    const geoKey = KeyFactory.driverGeoIndex(tenantId);
    const presenceKey = KeyFactory.driverPresenceZset(tenantId);

    await withObservability(this.obs, 'RedisDriverRepository.updateLocation', async () => {
      const pipeline = (this.client as any).pipeline();
      pipeline.hset(hashKey,
        'latitude', String(location.latitude),
        'longitude', String(location.longitude),
        'locationTimestamp', location.timestamp,
        'lastHeartbeat', location.timestamp
      );
      pipeline.geoadd(geoKey, location.longitude, location.latitude, driverId);
      pipeline.zadd(presenceKey, Date.now(), driverId);
      await pipeline.exec();
    });
  }

  async setDriverStatus(tenantId: TenantId, driverId: DriverId, status: DriverStatus): Promise<void> {
    TenantGuard.validate(tenantId);
    TenantGuard.validateDriverId(driverId);
    const key = KeyFactory.driverHash(tenantId, driverId);

    await withObservability(this.obs, 'RedisDriverRepository.setDriverStatus', async () => {
      await (this.client as any).hset(key, 'status', status);
    });

    this.obs.logger.debug(`Driver status updated`, { tenantId, driverId, status });
  }

  async findNearbyDrivers(
    tenantId: TenantId,
    location: Coordinates,
    radiusMeters: number,
    limit: number
  ): Promise<readonly Driver[]> {
    TenantGuard.validate(tenantId);
    const geoKey = KeyFactory.driverGeoIndex(tenantId);

    return withObservability(this.obs, 'RedisDriverRepository.findNearbyDrivers', async () => {
      // Use GEORADIUS with lon, lat, radius in meters
      const memberNames = await (this.client as any).georadius(
        geoKey,
        location.longitude,
        location.latitude,
        radiusMeters,
        'm',
        'COUNT', limit,
        'ASC'
      ) as string[];

      if (!memberNames || memberNames.length === 0) {
        this.obs.metrics.recordGeoQueryResults(tenantId, 0);
        return [];
      }

      // Batch fetch driver details via pipeline
      const pipeline = (this.client as any).pipeline();
      for (const driverId of memberNames) {
        pipeline.hgetall(KeyFactory.driverHash(tenantId, driverId));
      }
      const results = await pipeline.exec() as [Error | null, Record<string, string> | null][];

      const drivers: Driver[] = [];
      for (const [err, fields] of results) {
        if (err || !fields || Object.keys(fields).length === 0) continue;
        // Cross-tenant safety check
        if (fields['tenantId'] && fields['tenantId'] !== tenantId) continue;
        try {
          drivers.push(DriverSerializer.deserialize(fields));
        } catch {
          // Skip deserialization errors (version mismatch during rolling deploy)
        }
      }

      this.obs.metrics.recordGeoQueryResults(tenantId, drivers.length);
      this.obs.logger.debug(`Found ${drivers.length} nearby drivers`, {
        tenantId, radiusMeters, limit,
      });
      return drivers;
    });
  }
}
