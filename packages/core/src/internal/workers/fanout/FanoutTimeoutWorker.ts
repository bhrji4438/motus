import {
  TenantId,
  SessionId,
  SessionState,
  DispatchWaveStatus,
} from "@motus/types";
import {
  ISessionRepository,
  ILockManager,
  IClock,
  IIdGenerator,
} from "@/internal/interfaces/ports.js";
import { SessionEntity } from "@/internal/entities/entities.js";
import { FanoutEngine } from "@/internal/services/fanout/FanoutEngine.js";
import { SessionManager } from "@/internal/managers/SessionManager.js";
import { IMetricsCollector } from "@/internal/observability/observability.js";

export class FanoutTimeoutWorker {
  constructor(
    _sessionMgr: SessionManager,
    private readonly sessionRepo: ISessionRepository,
    private readonly lockMgr: ILockManager,
    private readonly fanoutEngine: FanoutEngine,
    private readonly clock: IClock,
    _idGen: IIdGenerator,
    private readonly metrics: IMetricsCollector
  ) {}

  public async checkWaveExpirations(
    tenantId: TenantId,
    sessionId: SessionId
  ): Promise<void> {
    const lockKey = `lock:session:${sessionId}`;
    const acquired = await this.lockMgr.acquireLock(lockKey, 10);
    if (!acquired) {
      return; // Skip if session is currently being modified
    }

    try {
      const session = await this.sessionRepo.get(tenantId, sessionId);
      if (!session || session.status !== SessionState.SEARCHING) {
        return;
      }

      const activeWaveIdx = session.waves.length - 1;
      const activeWave = session.waves[activeWaveIdx];

      if (!activeWave || activeWave.status !== DispatchWaveStatus.ACTIVE) {
        return;
      }

      const now = this.clock.now().getTime();
      const expiresAt = new Date(activeWave.expiresAt).getTime();

      if (now >= expiresAt) {
        // Wave has timed out!
        const updatedAssignments = activeWave.assignments.map((asg) => ({
          ...asg,
          status: "EXPIRED" as const,
        }));

        const updatedWave = {
          ...activeWave,
          status: DispatchWaveStatus.EXPIRED,
          assignments: updatedAssignments,
        };

        const updatedWaves = [...session.waves.slice(0, -1), updatedWave];

        const updatedSession = new SessionEntity(
          session.tenantId,
          session.id,
          session.status,
          session.pickupPoint,
          session.destinationPoint,
          session.telemetryPath,
          session.eventTimeline,
          updatedWaves,
          session.assignedDriverId,
          (session as any).requiredVehicleType
        );

        await this.sessionRepo.save(updatedSession);

        // Record timeout metric
        this.metrics.incrementAssignmentTimeout(tenantId);

        // Release candidate locks for the expired wave
        await this.fanoutEngine.releaseWaveLocks(
          sessionId,
          activeWave.candidates
        );

        // Advance to next wave
        await this.fanoutEngine.startNextWave(updatedSession);
      }
    } finally {
      await this.lockMgr.releaseLock(lockKey);
    }
  }
}
