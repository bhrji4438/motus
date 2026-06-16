import { TenantId } from "@motus/types";
import {
  IDriverRepository,
  ILockManager,
  IClock,
} from "@/internal/interfaces/ports.js";
import { DriverManager } from "@/internal/managers/DriverManager.js";
import { IMetricsCollector } from "@/internal/observability/observability.js";

export class DriverStaleDetector {
  constructor(
    private readonly driverMgr: DriverManager,
    private readonly driverRepo: IDriverRepository,
    private readonly lockMgr: ILockManager,
    private readonly clock: IClock,
    private readonly metrics: IMetricsCollector
  ) {}

  public async scanStaleDrivers(tenantId: TenantId): Promise<void> {
    const lockKey = `lock:presence:stale_scan:${tenantId}`;
    const acquired = await this.lockMgr.acquireLock(lockKey, 30);
    if (!acquired) {
      return; // Skip if scan is already running on another node
    }

    try {
      // Discover active drivers via spatial query or simply get all drivers
      // In a real repo, we query/get all registered drivers.
      // For this pure core, we retrieve through the driverRepo's spatial discover port or custom query.
      // Since driverRepo.findNearbyDrivers can find drivers, let's assume we query all online drivers
      // or we query driver repo for stale status.
      // In this stateless wrapper, let's assume we get all drivers within a large global radius (e.g. 100km)
      // centered at (0,0) to discover all active driver profiles in the region.
      const drivers = await this.driverRepo.findNearbyDrivers(
        tenantId,
        { latitude: 0, longitude: 0 },
        100000, // 100km
        1000 // Limit
      );

      const nowMs = this.clock.now().getTime();

      for (const driver of drivers) {
        if (
          driver.status === "ONLINE" ||
          driver.status === "BUSY" ||
          driver.status === "PAUSED"
        ) {
          const lastUpdate = new Date(driver.location.timestamp).getTime();
          const elapsedSec = (nowMs - lastUpdate) / 1000;

          if (elapsedSec > 120) {
            // Heartbeat missing > 120s! Transition to STALE
            await this.driverMgr.setDriverStale(tenantId, driver.id);
            this.metrics.incrementStaleDetection(tenantId);
          }
        }
      }
    } finally {
      await this.lockMgr.releaseLock(lockKey);
    }
  }
}
