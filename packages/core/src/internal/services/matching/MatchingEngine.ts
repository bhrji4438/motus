import {
  Session,
  Driver,
  DriverId,
  DriverStatus,
  MatchingStrategy
} from '@motus/types';
import {
  IDriverRepository,
  ITenantRepository,
  IEtaProvider,
  IMatchingProvider,
  IClock,
  ILogger
} from '@/internal/interfaces/ports.js';
import { IMetricsCollector } from '@/internal/observability/observability.js';
import { calculateHaversineDistance } from '@/internal/services/matching/haversine.js';
import { isPointInPolygon } from '@/internal/services/matching/raycast.js';

export class MatchingEngine {
  constructor(
    private readonly tenantRepo: ITenantRepository,
    private readonly driverRepo: IDriverRepository,
    private readonly clock: IClock,
    private readonly logger: ILogger,
    private readonly metrics: IMetricsCollector,
    private readonly etaProvider?: IEtaProvider,
    private readonly customMatchingProvider?: IMatchingProvider
  ) {}

  public async findCandidates(
    session: Session,
    radiusMeters: number,
    limit: number
  ): Promise<readonly DriverId[]> {
    const startTime = this.clock.now().getTime();
    const tenantId = session.tenantId;

    try {
      const tenant = await this.tenantRepo.get(tenantId);
      if (!tenant) {
        this.logger.error(`Tenant ${tenantId} not found during candidate matching.`);
        return [];
      }

      // 1. Discovery: Find nearby drivers
      const nearby = await this.driverRepo.findNearbyDrivers(
        tenantId,
        session.pickupPoint,
        radiusMeters,
        100 // Discover a larger pool to filter down
      );

      // 2. Filters Pipeline
      const filtered: Driver[] = [];
      const nowMs = this.clock.now().getTime();

      for (const driver of nearby) {
        // A. Location Freshness: age <= 120s
        const locationTime = new Date(driver.location.timestamp).getTime();
        const locationAgeSec = (nowMs - locationTime) / 1000;
        if (locationAgeSec > 120) {
          continue;
        }

        // B. Capacity & Status Check
        if (driver.status !== DriverStatus.ONLINE || driver.currentLoad >= driver.capacity) {
          continue;
        }

        // C. Vehicle Type Check
        const reqType = (session as any).requiredVehicleType;
        const drvVehicleType = (driver as any).vehicleType;
        if (reqType && drvVehicleType && drvVehicleType.toUpperCase() !== reqType.toUpperCase()) {
          continue;
        }

        // D. Geofence Zone Check
        // If tenant has operating zones, driver location must reside in at least one zone.
        if (tenant.zones && tenant.zones.length > 0) {
          let driverInZone = false;
          let pickupInZone = false;

          for (const zone of tenant.zones) {
            if (isPointInPolygon(driver.location, zone.boundary)) {
              driverInZone = true;
            }
            if (isPointInPolygon(session.pickupPoint, zone.boundary)) {
              pickupInZone = true;
            }
          }

          if (!driverInZone || !pickupInZone) {
            continue;
          }
        }

        filtered.push(driver);
      }

      if (filtered.length === 0) {
        return [];
      }

      // 3. Ranking Pipeline
      let ranked: { driverId: DriverId; score: number }[] = [];
      const strategy = tenant.matchingConfig.strategy;

      if (strategy === MatchingStrategy.ETA && this.etaProvider) {
        // Query ETAs with a strict 100ms timeout
        ranked = await this.rankByEtaWithFallback(session, filtered);
      } else if (strategy === MatchingStrategy.CUSTOM && this.customMatchingProvider) {
        const customScores = await this.customMatchingProvider.scoreCandidates(session, filtered);
        ranked = [...customScores];
      } else {
        // Fallback or explicit DISTANCE strategy: Sort by Haversine Distance
        ranked = filtered.map(driver => {
          const dist = calculateHaversineDistance(driver.location, session.pickupPoint);
          // For distance, smaller is better, so score = -dist (or sort ascending)
          return { driverId: driver.id, score: -dist };
        });
      }

      // Sort by score descending (highest score/nearest is first)
      ranked.sort((a, b) => b.score - a.score);

      // Record latency metrics
      const durationMs = this.clock.now().getTime() - startTime;
      this.metrics.recordMatchingLatency(tenantId, durationMs);

      return ranked.slice(0, limit).map(r => r.driverId);
    } catch (err: any) {
      this.logger.error(`Error in MatchingEngine: ${err.message}`, err);
      return [];
    }
  }

  private async rankByEtaWithFallback(
    session: Session,
    candidates: Driver[]
  ): Promise<{ driverId: DriverId; score: number }[]> {
    if (!this.etaProvider) {
      return this.rankByDistance(session, candidates);
    }

    try {
      // Create a promise that rejects after 100ms
      const timeoutPromise = new Promise<never>((_, reject) =>
        globalThis.setTimeout(() => reject(new Error('ETA calculation timed out')), 100)
      );

      // Perform all ETA calculations
      const etaPromise = Promise.all(
        candidates.map(async driver => {
          const eta = await this.etaProvider!.calculateEta(driver.location, session.pickupPoint);
          // score = -durationSeconds (shorter duration is better)
          return { driverId: driver.id, score: -eta.durationSeconds };
        })
      );

      // Race the calculations against the 100ms timeout
      return await Promise.race([etaPromise, timeoutPromise]);
    } catch (err: any) {
      this.logger.warn(`ETA calculation fallback to distance: ${err.message}`);
      return this.rankByDistance(session, candidates);
    }
  }

  private rankByDistance(session: Session, candidates: Driver[]): { driverId: DriverId; score: number }[] {
    return candidates.map(driver => {
      const dist = calculateHaversineDistance(driver.location, session.pickupPoint);
      return { driverId: driver.id, score: -dist };
    });
  }
}
