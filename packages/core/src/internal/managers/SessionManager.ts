import {
  Session,
  SessionId,
  TenantId,
  CreateSessionCommand,
  CancelSessionCommand,
  CompleteSessionCommand,
  ReassignSessionCommand,
  SessionState,
  Location,
} from "@motus/types";
import {
  ISessionRepository,
  ILockManager,
  IEventBus,
  IClock,
  IIdGenerator,
} from "@/internal/interfaces/ports.js";
import { SessionEntity } from "@/internal/entities/entities.js";
import { ErrorFactory } from "@/internal/errors/ErrorFactory.js";
import { StateMachineManager } from "@/internal/state/StateMachineManager.js";
import { DriverManager } from "@/internal/managers/DriverManager.js";

export class SessionManager {
  private readonly stateMachine = new StateMachineManager();

  constructor(
    private readonly sessionRepo: ISessionRepository,
    private readonly lockMgr: ILockManager,
    private readonly eventBus: IEventBus,
    private readonly clock: IClock,
    private readonly idGen: IIdGenerator,
    private readonly driverMgr: DriverManager
  ) {}

  public async createSession(command: CreateSessionCommand): Promise<Session> {
    const existing = await this.sessionRepo.get(
      command.tenantId,
      command.sessionId
    );
    if (existing) {
      return existing; // Idempotency
    }

    const nowStr = this.clock.now().toISOString();
    const pickup: Location = { ...command.pickup, timestamp: nowStr };
    const destination: Location = { ...command.destination, timestamp: nowStr };

    const session = new SessionEntity(
      command.tenantId,
      command.sessionId,
      SessionState.CREATED,
      pickup,
      destination,
      [],
      [],
      [],
      undefined,
      command.requiredVehicleType
    );

    await this.sessionRepo.save(session);

    this.eventBus.publish({
      eventId: this.idGen.generateEventId(),
      eventName: "session.created",
      timestamp: nowStr,
      tenantId: command.tenantId,
      payload: {
        tenantId: command.tenantId,
        sessionId: command.sessionId,
        pickup: command.pickup,
        destination: command.destination,
      },
      governance: {
        producer: "SessionService",
        consumers: ["MatchingEngine", "SocketServer"],
        deliveryGuarantee: "AT_LEAST_ONCE",
        orderingScope: "SESSION",
        partitionKey: "sessionId",
        idempotencyRequirements:
          "Deduplicate by sessionId, initialize session lifecycle context.",
        version: "1.0.0",
      },
    });

    // Automatically transition to SEARCHING state to trigger matching
    return await this.startMatching(command.tenantId, command.sessionId);
  }

  public async startMatching(
    tenantId: TenantId,
    sessionId: SessionId
  ): Promise<Session> {
    const lockKey = `lock:session:${sessionId}`;
    const acquired = await this.lockMgr.acquireLock(lockKey, 10);
    if (!acquired) {
      throw ErrorFactory.lockAcquisitionFailed(
        lockKey,
        "Failed to lock session during transition to SEARCHING."
      );
    }

    try {
      const session = await this.sessionRepo.get(tenantId, sessionId);
      if (!session) {
        throw ErrorFactory.sessionNotFound(sessionId, tenantId);
      }

      this.stateMachine.validateSessionTransition(
        session.status,
        SessionState.SEARCHING
      );

      const updated = new SessionEntity(
        session.tenantId,
        session.id,
        SessionState.SEARCHING,
        session.pickupPoint,
        session.destinationPoint,
        session.telemetryPath,
        session.eventTimeline,
        session.waves,
        session.assignedDriverId,
        (session as any).requiredVehicleType
      );

      await this.sessionRepo.save(updated);

      this.eventBus.publish({
        eventId: this.idGen.generateEventId(),
        eventName: "session.searching",
        timestamp: this.clock.now().toISOString(),
        tenantId,
        payload: {
          tenantId,
          sessionId,
        },
        governance: {
          producer: "DispatchEngine",
          consumers: ["MatchingEngine", "SocketServer"],
          deliveryGuarantee: "AT_LEAST_ONCE",
          orderingScope: "SESSION",
          partitionKey: "sessionId",
          idempotencyRequirements:
            "Avoid triggering multiple matching candidate searches concurrently.",
          version: "1.0.0",
        },
      });

      return updated;
    } finally {
      await this.lockMgr.releaseLock(lockKey);
    }
  }

  public async cancelSession(command: CancelSessionCommand): Promise<Session> {
    const lockKey = `lock:session:${command.sessionId}`;
    const acquired = await this.lockMgr.acquireLock(lockKey, 10);
    if (!acquired) {
      throw ErrorFactory.lockAcquisitionFailed(
        lockKey,
        "Failed to lock session for cancellation."
      );
    }

    try {
      const session = await this.sessionRepo.get(
        command.tenantId,
        command.sessionId
      );
      if (!session) {
        throw ErrorFactory.sessionNotFound(command.sessionId, command.tenantId);
      }

      // Idempotency: if already CANCELLED, return it
      if (session.status === SessionState.CANCELLED) {
        return session;
      }

      this.stateMachine.validateSessionTransition(
        session.status,
        SessionState.CANCELLED
      );

      if (session.assignedDriverId) {
        // Strict lock ordering hierarchy: Session lock is already acquired, now we can lock Driver if needed.
        // But since DriverManager handles its own saving, we invoke it:
        await this.driverMgr.unbindDriver(
          command.tenantId,
          session.assignedDriverId
        );
      }

      const updated = new SessionEntity(
        session.tenantId,
        session.id,
        SessionState.CANCELLED,
        session.pickupPoint,
        session.destinationPoint,
        session.telemetryPath,
        session.eventTimeline,
        session.waves,
        undefined,
        (session as any).requiredVehicleType
      );

      await this.sessionRepo.save(updated);

      const payload: any = {
        tenantId: command.tenantId,
        sessionId: command.sessionId,
      };
      if (command.reason !== undefined && command.reason !== null) {
        payload.reason = command.reason;
      }

      this.eventBus.publish({
        eventId: this.idGen.generateEventId(),
        eventName: "session.cancelled",
        timestamp: this.clock.now().toISOString(),
        tenantId: command.tenantId,
        payload,
        governance: {
          producer: "SessionService",
          consumers: ["FanoutEngine", "SocketServer"],
          deliveryGuarantee: "AT_LEAST_ONCE",
          orderingScope: "SESSION",
          partitionKey: "sessionId",
          idempotencyRequirements:
            "Deduplicate, release driver reservations, terminate outstanding offers.",
          version: "1.0.0",
        },
      });

      return updated;
    } finally {
      await this.lockMgr.releaseLock(lockKey);
    }
  }

  public async completeSession(
    command: CompleteSessionCommand
  ): Promise<Session> {
    const lockKey = `lock:session:${command.sessionId}`;
    const acquired = await this.lockMgr.acquireLock(lockKey, 10);
    if (!acquired) {
      throw ErrorFactory.lockAcquisitionFailed(
        lockKey,
        "Failed to lock session for completion."
      );
    }

    try {
      const session = await this.sessionRepo.get(
        command.tenantId,
        command.sessionId
      );
      if (!session) {
        throw ErrorFactory.sessionNotFound(command.sessionId, command.tenantId);
      }

      // Idempotency: if already COMPLETED, return it
      if (session.status === SessionState.COMPLETED) {
        return session;
      }

      this.stateMachine.validateSessionTransition(
        session.status,
        SessionState.COMPLETED
      );

      if (session.assignedDriverId) {
        await this.driverMgr.unbindDriver(
          command.tenantId,
          session.assignedDriverId
        );
      }

      const updated = new SessionEntity(
        session.tenantId,
        session.id,
        SessionState.COMPLETED,
        session.pickupPoint,
        session.destinationPoint,
        session.telemetryPath,
        session.eventTimeline,
        session.waves,
        session.assignedDriverId,
        (session as any).requiredVehicleType
      );

      await this.sessionRepo.save(updated);

      this.eventBus.publish({
        eventId: this.idGen.generateEventId(),
        eventName: "session.completed",
        timestamp: this.clock.now().toISOString(),
        tenantId: command.tenantId,
        payload: {
          tenantId: command.tenantId,
          sessionId: command.sessionId,
          driverId: session.assignedDriverId || "",
        },
        governance: {
          producer: "SessionService",
          consumers: ["ReportGenerator", "SocketServer"],
          deliveryGuarantee: "AT_LEAST_ONCE",
          orderingScope: "SESSION",
          partitionKey: "sessionId",
          idempotencyRequirements:
            "Deduplicate, trigger session report compiler pipeline.",
          version: "1.0.0",
        },
      });

      return updated;
    } finally {
      await this.lockMgr.releaseLock(lockKey);
    }
  }

  public async reassignSession(
    command: ReassignSessionCommand
  ): Promise<Session> {
    const lockKey = `lock:session:${command.sessionId}`;
    const acquired = await this.lockMgr.acquireLock(lockKey, 10);
    if (!acquired) {
      throw ErrorFactory.lockAcquisitionFailed(
        lockKey,
        "Failed to lock session for reassignment."
      );
    }

    try {
      const session = await this.sessionRepo.get(
        command.tenantId,
        command.sessionId
      );
      if (!session) {
        throw ErrorFactory.sessionNotFound(command.sessionId, command.tenantId);
      }

      this.stateMachine.validateSessionTransition(
        session.status,
        SessionState.SEARCHING
      );

      if (session.assignedDriverId) {
        await this.driverMgr.unbindDriver(
          command.tenantId,
          session.assignedDriverId
        );
      }

      const updated = new SessionEntity(
        session.tenantId,
        session.id,
        SessionState.SEARCHING,
        session.pickupPoint,
        session.destinationPoint,
        session.telemetryPath,
        session.eventTimeline,
        session.waves,
        undefined,
        (session as any).requiredVehicleType
      );

      await this.sessionRepo.save(updated);

      this.eventBus.publish({
        eventId: this.idGen.generateEventId(),
        eventName: "session.searching",
        timestamp: this.clock.now().toISOString(),
        tenantId: command.tenantId,
        payload: {
          tenantId: command.tenantId,
          sessionId: command.sessionId,
        },
        governance: {
          producer: "DispatchEngine",
          consumers: ["MatchingEngine", "SocketServer"],
          deliveryGuarantee: "AT_LEAST_ONCE",
          orderingScope: "SESSION",
          partitionKey: "sessionId",
          idempotencyRequirements:
            "Avoid triggering multiple matching candidate searches concurrently.",
          version: "1.0.0",
        },
      });

      return updated;
    } finally {
      await this.lockMgr.releaseLock(lockKey);
    }
  }

  public async getSession(
    tenantId: TenantId,
    sessionId: SessionId
  ): Promise<Session> {
    const session = await this.sessionRepo.get(tenantId, sessionId);
    if (!session) {
      throw ErrorFactory.sessionNotFound(sessionId, tenantId);
    }
    return session;
  }
}
