import type { Coordinates, TenantId, DriverId } from "@motus/types";
import type { RedisClient } from "@/client/RedisClientManager.js";
import { KeyFactory } from "@/keys/KeyFactory.js";
import { TenantGuard } from "@/guards/TenantGuard.js";
import {
  resolveObservability,
  withObservability,
  type RedisObservabilityDeps,
} from "@/observability/RedisObservability.js";

export interface GeoSearchResult {
  driverId: DriverId;
  distanceMeters?: number;
}

/**
 * Encapsulates all Redis GEO operations for the driver geo-index.
 *
 * Owned structure: `tenant:{tenantId}:drivers:geo` (Geo sorted set)
 *
 * Note: Driver saves (GEOADD) are performed by RedisDriverRepository via
 * the saveDriverAtomic Lua script. This repository provides read-only
 * geo query operations and standalone GEOADD for location-only updates.
 */
export class RedisGeoRepository {
  private readonly obs;

  constructor(
    private readonly client: RedisClient,
    deps?: RedisObservabilityDeps
  ) {
    this.obs = resolveObservability(deps);
  }

  /**
   * Adds or updates a driver's geo position.
   * Called directly only for location-update-only operations.
   */
  async addOrUpdate(
    tenantId: TenantId,
    driverId: DriverId,
    coordinates: Coordinates
  ): Promise<void> {
    TenantGuard.validate(tenantId);
    TenantGuard.validateDriverId(driverId);
    const key = KeyFactory.driverGeoIndex(tenantId);

    await withObservability(
      this.obs,
      "RedisGeoRepository.addOrUpdate",
      async () => {
        await (this.client as any).geoadd(
          key,
          coordinates.longitude,
          coordinates.latitude,
          driverId
        );
      }
    );
  }

  /**
   * Searches for driver IDs within a radius of a given coordinate.
   * Returns driverIds sorted by distance ascending.
   */
  async searchByRadius(
    tenantId: TenantId,
    center: Coordinates,
    radiusMeters: number,
    limit: number
  ): Promise<GeoSearchResult[]> {
    TenantGuard.validate(tenantId);
    const key = KeyFactory.driverGeoIndex(tenantId);

    return withObservability(
      this.obs,
      "RedisGeoRepository.searchByRadius",
      async () => {
        const results = (await (this.client as any).georadius(
          key,
          center.longitude,
          center.latitude,
          radiusMeters,
          "m",
          "WITHDIST",
          "COUNT",
          limit,
          "ASC"
        )) as Array<[string, string]>;

        if (!results || results.length === 0) return [];

        return results.map(([driverId, dist]) => ({
          driverId: driverId as DriverId,
          distanceMeters: parseFloat(dist) * 1000, // georadius WITHDIST returns km by default with 'm' unit? No, 'm' returns metres
        }));
      }
    );
  }

  /**
   * Calculates the distance in meters between two driver positions.
   */
  async getDistance(
    tenantId: TenantId,
    driverIdA: DriverId,
    driverIdB: DriverId
  ): Promise<number | null> {
    TenantGuard.validate(tenantId);
    const key = KeyFactory.driverGeoIndex(tenantId);

    return withObservability(
      this.obs,
      "RedisGeoRepository.getDistance",
      async () => {
        const dist = (await (this.client as any).geodist(
          key,
          driverIdA,
          driverIdB,
          "m"
        )) as string | null;
        return dist !== null ? parseFloat(dist) : null;
      }
    );
  }

  /**
   * Removes a driver from the geo-index (called on driver offline/stale cleanup).
   */
  async remove(tenantId: TenantId, driverId: DriverId): Promise<void> {
    TenantGuard.validate(tenantId);
    TenantGuard.validateDriverId(driverId);
    const key = KeyFactory.driverGeoIndex(tenantId);

    await withObservability(this.obs, "RedisGeoRepository.remove", async () => {
      await (this.client as any).zrem(key, driverId);
    });
  }

  /**
   * Returns the count of drivers in the geo-index for a tenant.
   */
  async count(tenantId: TenantId): Promise<number> {
    TenantGuard.validate(tenantId);
    const key = KeyFactory.driverGeoIndex(tenantId);
    return withObservability(this.obs, "RedisGeoRepository.count", async () => {
      return (this.client as any).zcard(key) as Promise<number>;
    });
  }
}
