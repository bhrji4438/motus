import { TenantId, SessionId, SessionState } from '@motus/types';
import { ISessionRepository, ILockManager, IEventBus, IClock, IIdGenerator } from '@/internal/interfaces/ports.js';
import { SessionEntity } from '@/internal/entities/entities.js';
import { StateMachineManager } from '@/internal/state/StateMachineManager.js';
import { SessionManager } from '@/internal/managers/SessionManager.js';
import { IMetricsCollector } from '@/internal/observability/observability.js';

export class DriverLostMonitor {
  private readonly stateMachine = new StateMachineManager();

  constructor(
    private readonly sessionMgr: SessionManager,
    private readonly sessionRepo: ISessionRepository,
    private readonly lockMgr: ILockManager,
    private readonly eventBus: IEventBus,
    private readonly clock: IClock,
    private readonly idGen: IIdGenerator,
    private readonly metrics: IMetricsCollector
  ) {}

  /**
   * Transitions session to DRIVER_LOST and stashes the previous state.
   */
  public async handleDriverDisconnect(tenantId: TenantId, sessionId: SessionId): Promise<void> {
    const lockKey = `lock:session:${sessionId}`;
    const acquired = await this.lockMgr.acquireLock(lockKey, 10);
    if (!acquired) {
      return; // Skip if locked
    }

    try {
      const session = await this.sessionRepo.get(tenantId, sessionId);
      if (!session) {
        return;
      }

      // Prohibited transition check
      this.stateMachine.validateSessionTransition(session.status, SessionState.DRIVER_LOST);

      // Stash current state as previousSessionState
      const updated = new SessionEntity(
        session.tenantId,
        session.id,
        SessionState.DRIVER_LOST,
        session.pickupPoint,
        session.destinationPoint,
        session.telemetryPath,
        session.eventTimeline,
        session.waves,
        session.assignedDriverId,
        (session as any).requiredVehicleType,
        session.status // previousSessionState
      );

      await this.sessionRepo.save(updated);

      // Publish event
      this.eventBus.publish({
        eventId: this.idGen.generateEventId(),
        eventName: 'session.driver_lost',
        timestamp: this.clock.now().toISOString(),
        tenantId,
        payload: {
          tenantId,
          sessionId,
          lastKnownLocation: session.telemetryPath[session.telemetryPath.length - 1]
        },
        governance: {
          producer: 'PresenceMonitor',
          consumers: ['DispatchEngine', 'SocketServer'],
          deliveryGuarantee: 'AT_LEAST_ONCE',
          orderingScope: 'SESSION',
          partitionKey: 'sessionId',
          idempotencyRequirements: 'Initiate session recovery grace period timer.',
          version: '1.0.0'
        }
      });

      this.metrics.incrementDriverLost(tenantId);
    } finally {
      await this.lockMgr.releaseLock(lockKey);
    }
  }

  /**
   * Reconnects driver and restores the stashed session state.
   */
  public async handleDriverReconnect(tenantId: TenantId, sessionId: SessionId): Promise<void> {
    const lockKey = `lock:session:${sessionId}`;
    const acquired = await this.lockMgr.acquireLock(lockKey, 10);
    if (!acquired) {
      return;
    }

    try {
      const session = await this.sessionRepo.get(tenantId, sessionId);
      if (!session || session.status !== SessionState.DRIVER_LOST) {
        return;
      }

      const prev = (session as any).previousSessionState || SessionState.DRIVER_ASSIGNED;

      this.stateMachine.validateSessionTransition(session.status, prev, { previousState: prev });

      const updated = new SessionEntity(
        session.tenantId,
        session.id,
        prev,
        session.pickupPoint,
        session.destinationPoint,
        session.telemetryPath,
        session.eventTimeline,
        session.waves,
        session.assignedDriverId,
        (session as any).requiredVehicleType,
        undefined // Clear stashed state
      );

      await this.sessionRepo.save(updated);
    } finally {
      await this.lockMgr.releaseLock(lockKey);
    }
  }

  /**
   * Reassigns the session if the 180s grace period has expired without reconnect.
   */
  public async handleRecoveryTimeout(tenantId: TenantId, sessionId: SessionId): Promise<void> {
    const lockKey = `lock:session:${sessionId}`;
    const acquired = await this.lockMgr.acquireLock(lockKey, 10);
    if (!acquired) {
      return;
    }

    try {
      const session = await this.sessionRepo.get(tenantId, sessionId);
      if (!session || session.status !== SessionState.DRIVER_LOST) {
        return;
      }

      // Release locks and return to SEARCHING
      await this.sessionMgr.reassignSession({
        tenantId,
        sessionId,
        reason: 'Recovery grace period expired without driver reconnection.',
        idempotencyKey: this.idGen.generateEventId()
      });
    } finally {
      await this.lockMgr.releaseLock(lockKey);
    }
  }
}
