import {
  Session,
  DriverId,
  Assignment,
  DispatchWave,
  DispatchWaveStatus,
  SessionState
} from '@motus/types';
import { ILockManager, IEventBus, IClock, IIdGenerator } from '@/internal/interfaces/ports.js';
import { SessionEntity } from '@/internal/entities/entities.js';
import { MatchingEngine } from '@/internal/services/matching/MatchingEngine.js';
import { ConfigurationManager } from '@/public/config/ConfigurationManager.js';
import { IMetricsCollector } from '@/internal/observability/observability.js';
import { SessionManager } from '@/internal/managers/SessionManager.js';

export class FanoutEngine {
  constructor(
    private readonly sessionMgr: SessionManager,
    private readonly matchingEngine: MatchingEngine,
    private readonly configMgr: ConfigurationManager,
    private readonly lockMgr: ILockManager,
    private readonly eventBus: IEventBus,
    private readonly clock: IClock,
    private readonly idGen: IIdGenerator,
    private readonly metrics: IMetricsCollector
  ) {}

  public async startNextWave(session: Session): Promise<void> {
    const tenantId = session.tenantId;

    // Load matching and fanout config
    const matchingConfig = await this.configMgr.getMatchingConfig(tenantId);
    const fanoutConfig = await this.configMgr.getFanoutConfig(tenantId);

    // Get current wave count to determine radius expansion
    const nextWaveNum = session.waves.length + 1;

    // Radius expansion math: initialRadius + (wave - 1) * 2000 meters
    const initialRadius = matchingConfig.initialRadiusMeters;
    const currentRadius = Math.min(
      matchingConfig.maxRadiusMeters,
      initialRadius + (nextWaveNum - 1) * 2000
    );

    // Find candidate drivers
    const candidateIds = await this.matchingEngine.findCandidates(
      session,
      currentRadius,
      fanoutConfig.waveSize
    );

    if (candidateIds.length === 0) {
      // No candidates found
      this.eventBus.publish({
        eventId: this.idGen.generateEventId(),
        eventName: 'dispatch.no_driver_found',
        timestamp: this.clock.now().toISOString(),
        tenantId,
        payload: {
          tenantId,
          sessionId: session.id
        },
        governance: {
          producer: 'MatchingEngine',
          consumers: ['SessionService', 'SocketServer'],
          deliveryGuarantee: 'AT_LEAST_ONCE',
          orderingScope: 'SESSION',
          partitionKey: 'sessionId',
          idempotencyRequirements: 'Escalate matching rules or transition session to cancelled.',
          version: '1.0.0'
        }
      });
      return;
    }

    // Lock and reserve candidates
    const assignments: Assignment[] = [];
    const reservedCandidates: DriverId[] = [];

    const nowStr = this.clock.now().toISOString();
    const expiresAt = new Date(
      this.clock.now().getTime() + fanoutConfig.waveTimeoutSeconds * 1000
    ).toISOString();

    const startTime = this.clock.now().getTime();

    for (const driverId of candidateIds) {
      // Lock ordering hierarchy: Session lock -> Driver lock -> Candidate Reservation lock
      const driverLockKey = `lock:driver:${driverId}`;
      const candidateLockKey = `lock:candidate:${driverId}:session:${session.id}`;

      // Acquire Driver lock (10s)
      const driverLocked = await this.lockMgr.acquireLock(driverLockKey, 10);
      if (driverLocked) {
        // Acquire Candidate Reservation lock (8s)
        const candLocked = await this.lockMgr.acquireLock(
          candidateLockKey,
          fanoutConfig.waveTimeoutSeconds
        );

        if (candLocked) {
          assignments.push({
            driverId,
            sessionId: session.id,
            status: 'PENDING' as const,
            lockAcquired: true
          });
          reservedCandidates.push(driverId);
        } else {
          // Release driver lock if candidate lock failed
          await this.lockMgr.releaseLock(driverLockKey);
        }
      }
    }

    if (reservedCandidates.length === 0) {
      // Couldn't reserve any driver
      return;
    }

    // Create the DispatchWave object
    const wave: DispatchWave = {
      waveNumber: nextWaveNum,
      status: DispatchWaveStatus.ACTIVE,
      candidates: reservedCandidates,
      assignments,
      startedAt: nowStr,
      expiresAt
    };

    // Update Session with the new wave
    const updatedWaves = [...session.waves, wave];
    const sessionLockKey = `lock:session:${session.id}`;
    const sessionLocked = await this.lockMgr.acquireLock(sessionLockKey, 10);

    if (sessionLocked) {
      try {
        const currentSession = await this.sessionMgr.getSession(tenantId, session.id);
        if (currentSession.status === SessionState.SEARCHING) {
          const updatedSession = new SessionEntity(
            currentSession.tenantId,
            currentSession.id,
            currentSession.status,
            currentSession.pickupPoint,
            currentSession.destinationPoint,
            currentSession.telemetryPath,
            currentSession.eventTimeline,
            updatedWaves,
            currentSession.assignedDriverId,
            (currentSession as any).requiredVehicleType
          );

          await this.sessionMgr['sessionRepo'].save(updatedSession);

          // Publish event
          this.eventBus.publish({
            eventId: this.idGen.generateEventId(),
            eventName: 'dispatch.wave.started',
            timestamp: nowStr,
            tenantId,
            payload: {
              tenantId,
              sessionId: session.id,
              waveNumber: nextWaveNum,
              candidates: reservedCandidates,
              expiresAt
            },
            governance: {
              producer: 'FanoutEngine',
              consumers: ['SocketServer'],
              deliveryGuarantee: 'AT_LEAST_ONCE',
              orderingScope: 'SESSION',
              partitionKey: 'sessionId',
              idempotencyRequirements: 'Notify candidates, start wave timer check.',
              version: '1.0.0'
            }
          });

          // Record fanout latency metrics
          const durationMs = this.clock.now().getTime() - startTime;
          this.metrics.recordFanoutDuration(tenantId, durationMs);
        } else {
          // Clean up acquired candidate locks if session is no longer searching
          await this.releaseWaveLocks(session.id, reservedCandidates);
        }
      } finally {
        await this.lockMgr.releaseLock(sessionLockKey);
      }
    } else {
      await this.releaseWaveLocks(session.id, reservedCandidates);
    }
  }

  public async releaseWaveLocks(sessionId: string, candidateIds: readonly DriverId[]): Promise<void> {
    for (const driverId of candidateIds) {
      await this.lockMgr.releaseLock(`lock:driver:${driverId}`);
      await this.lockMgr.releaseLock(`lock:candidate:${driverId}:session:${sessionId}`);
    }
  }
}
