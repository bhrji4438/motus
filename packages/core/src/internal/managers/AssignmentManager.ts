import {
  TenantId,
  DriverId,
  SessionId,
  SessionState,
  DispatchWaveStatus,
  Assignment
} from '@motus/types';
import { ISessionRepository, ILockManager, IEventBus, IClock, IIdGenerator, IEtaProvider } from '@/internal/interfaces/ports.js';
import { SessionEntity } from '@/internal/entities/entities.js';
import { ErrorFactory } from '@/internal/errors/ErrorFactory.js';
import { StateMachineManager } from '@/internal/state/StateMachineManager.js';
import { DriverManager } from '@/internal/managers/DriverManager.js';
import { FanoutEngine } from '@/internal/services/fanout/FanoutEngine.js';
import { IMetricsCollector } from '@/internal/observability/observability.js';

export class AssignmentManager {
  private readonly stateMachine = new StateMachineManager();

  constructor(
    private readonly sessionRepo: ISessionRepository,
    private readonly lockMgr: ILockManager,
    private readonly eventBus: IEventBus,
    private readonly clock: IClock,
    private readonly idGen: IIdGenerator,
    private readonly driverMgr: DriverManager,
    private readonly fanoutEngine: FanoutEngine,
    private readonly metrics: IMetricsCollector,
    private readonly etaProvider?: IEtaProvider
  ) {}

  public async acceptSessionOffer(
    tenantId: TenantId,
    driverId: DriverId,
    sessionId: SessionId,
    waveNumber: number
  ): Promise<void> {
    const sessionLockKey = `lock:session:${sessionId}`;
    const sessionLocked = await this.lockMgr.acquireLock(sessionLockKey, 10);
    if (!sessionLocked) {
      throw ErrorFactory.lockAcquisitionFailed(sessionLockKey, 'Failed to lock session during offer acceptance.');
    }

    try {
      const session = await this.sessionRepo.get(tenantId, sessionId);
      if (!session) {
        throw ErrorFactory.sessionNotFound(sessionId, tenantId);
      }

      // Idempotency: if already assigned to this driver, return success
      if (session.status === SessionState.DRIVER_ASSIGNED && session.assignedDriverId === driverId) {
        return;
      }

      this.stateMachine.validateSessionTransition(session.status, SessionState.DRIVER_ASSIGNED);

      // Verify active wave
      const activeWave = session.waves[session.waves.length - 1];
      if (!activeWave || activeWave.waveNumber !== waveNumber || activeWave.status !== DispatchWaveStatus.ACTIVE) {
        throw ErrorFactory.invalidTransition(
          session.status,
          SessionState.DRIVER_ASSIGNED,
          `Active matching wave mismatch. Provided: wave ${waveNumber}.`
        );
      }

      // Verify candidate presence in the wave
      const isCandidate = activeWave.candidates.includes(driverId);
      if (!isCandidate) {
        throw ErrorFactory.invalidTransition(
          session.status,
          SessionState.DRIVER_ASSIGNED,
          `Driver ${driverId} is not a candidate for matching wave ${waveNumber}.`
        );
      }

      // Acquire Driver Lock to bind capacity
      const driverLockKey = `lock:driver:${driverId}`;
      const driverLocked = await this.lockMgr.acquireLock(driverLockKey, 10);
      if (!driverLocked) {
        throw ErrorFactory.lockAcquisitionFailed(driverLockKey, 'Failed to lock driver to bind capacity.');
      }

      try {
        // Increment driver load and potentially transition driver to BUSY
        await this.driverMgr.bindDriver(tenantId, driverId);

        // Update wave assignments
        const updatedAssignments = activeWave.assignments.map((asg): Assignment => {
          if (asg.driverId === driverId) {
            return { ...asg, status: 'ACCEPTED' as const };
          }
          return { ...asg, status: 'EXPIRED' as const };
        });

        const updatedWave = {
          ...activeWave,
          status: DispatchWaveStatus.COMPLETED,
          assignments: updatedAssignments
        };

        const updatedWaves = [...session.waves.slice(0, -1), updatedWave];

        const updatedSession = new SessionEntity(
          session.tenantId,
          session.id,
          SessionState.DRIVER_ASSIGNED,
          session.pickupPoint,
          session.destinationPoint,
          session.telemetryPath,
          session.eventTimeline,
          updatedWaves,
          driverId,
          (session as any).requiredVehicleType
        );

        await this.sessionRepo.save(updatedSession);

        // Calculate initial ETA if provider exists
        let etaSec = 300; // default 5 mins
        if (this.etaProvider) {
          try {
            const driver = await this.driverMgr.getDriver(tenantId, driverId);
            const eta = await this.etaProvider.calculateEta(driver.location, session.pickupPoint);
            etaSec = eta.durationSeconds;
          } catch {
            // ignore routing errors, fallback to default
          }
        }

        // Publish events
        const nowStr = this.clock.now().toISOString();
        this.eventBus.publish({
          eventId: this.idGen.generateEventId(),
          eventName: 'session.assigned',
          timestamp: nowStr,
          tenantId,
          payload: {
            tenantId,
            sessionId,
            assignedDriverId: driverId,
            estimatedDurationSeconds: etaSec
          },
          governance: {
            producer: 'DispatchEngine',
            consumers: ['TrackingEngine', 'SocketServer'],
            deliveryGuarantee: 'AT_LEAST_ONCE',
            orderingScope: 'SESSION',
            partitionKey: 'sessionId',
            idempotencyRequirements: 'Lock driver assignment exclusively to prevent double allocation.',
            version: '1.0.0'
          }
        });

        this.eventBus.publish({
          eventId: this.idGen.generateEventId(),
          eventName: 'dispatch.wave.completed',
          timestamp: nowStr,
          tenantId,
          payload: {
            tenantId,
            sessionId,
            waveNumber,
            acceptedDriverId: driverId
          },
          governance: {
            producer: 'FanoutEngine',
            consumers: ['SessionService', 'SocketServer'],
            deliveryGuarantee: 'AT_LEAST_ONCE',
            orderingScope: 'SESSION',
            partitionKey: 'sessionId',
            idempotencyRequirements: 'Clear outstanding wave assignments, update assigned driver.',
            version: '1.0.0'
          }
        });

        // Record metrics
        this.metrics.incrementAssignmentSuccess(tenantId);

        // Release other locks for this wave
        const remainingCandidates = activeWave.candidates.filter(cid => cid !== driverId);
        await this.fanoutEngine.releaseWaveLocks(sessionId, remainingCandidates);
      } finally {
        await this.lockMgr.releaseLock(driverLockKey);
      }
    } finally {
      await this.lockMgr.releaseLock(sessionLockKey);
    }
  }

  public async rejectSessionOffer(
    tenantId: TenantId,
    driverId: DriverId,
    sessionId: SessionId,
    waveNumber: number
  ): Promise<void> {
    const sessionLockKey = `lock:session:${sessionId}`;
    const sessionLocked = await this.lockMgr.acquireLock(sessionLockKey, 10);
    if (!sessionLocked) {
      throw ErrorFactory.lockAcquisitionFailed(sessionLockKey, 'Failed to lock session during offer rejection.');
    }

    try {
      const session = await this.sessionRepo.get(tenantId, sessionId);
      if (!session) {
        throw ErrorFactory.sessionNotFound(sessionId, tenantId);
      }

      // Verify active wave
      const activeWave = session.waves[session.waves.length - 1];
      if (!activeWave || activeWave.waveNumber !== waveNumber || activeWave.status !== DispatchWaveStatus.ACTIVE) {
        return; // Wave already inactive or mismatched, ignore (idempotent rejection)
      }

      // Verify candidate
      if (!activeWave.candidates.includes(driverId)) {
        return;
      }

      // Update assignment to REJECTED
      const updatedAssignments = activeWave.assignments.map((asg): Assignment => {
        if (asg.driverId === driverId) {
          return { ...asg, status: 'REJECTED' as const };
        }
        return asg;
      });

      const updatedWave = {
        ...activeWave,
        assignments: updatedAssignments
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

      // Release candidate reservation locks for this driver instantly
      await this.lockMgr.releaseLock(`lock:candidate:${driverId}:session:${sessionId}`);
      await this.lockMgr.releaseLock(`lock:driver:${driverId}`);

      // Check if all candidates in the wave have rejected or expired
      const hasPending = updatedAssignments.some(asg => asg.status === 'PENDING');
      if (!hasPending) {
        // Complete the wave as expired since all candidates rejected
        const waveCompleted = {
          ...updatedWave,
          status: DispatchWaveStatus.EXPIRED
        };
        const finalWaves = [...session.waves.slice(0, -1), waveCompleted];

        const finalSession = new SessionEntity(
          session.tenantId,
          session.id,
          session.status,
          session.pickupPoint,
          session.destinationPoint,
          session.telemetryPath,
          session.eventTimeline,
          finalWaves,
          session.assignedDriverId,
          (session as any).requiredVehicleType
        );

        await this.sessionRepo.save(finalSession);

        // Immediately trigger the next wave instead of waiting for timeout
        await this.fanoutEngine.startNextWave(finalSession);
      }
    } finally {
      await this.lockMgr.releaseLock(sessionLockKey);
    }
  }
}
