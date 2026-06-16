import { ErrorCode, DriverNamespace } from "@motus/types";
import { ConnectionRegistry } from "@/managers/ConnectionRegistry.js";
import { SubscriptionManager } from "@/managers/SubscriptionManager.js";
import { RoomManager } from "@/managers/RoomManager.js";
import { MetricsManager } from "@/observability/MetricsManager.js";
import {
  createInvalidArgumentError,
  createUnauthorizedError,
} from "@/errors/errors.js";

export class EventRouter {
  constructor(
    private readonly driverNamespace: DriverNamespace,
    private readonly connectionRegistry: ConnectionRegistry,
    private readonly subscriptionManager: SubscriptionManager,
    private readonly roomManager: RoomManager,
    private readonly metrics: MetricsManager,
    private readonly maxSubscriptionsPerSocket: number = 50
  ) {}

  /**
   * Main entry point routing client events to appropriate gateway actions.
   */
  public async handleClientEvent(
    socketId: string,
    event: string,
    payload: any
  ): Promise<void> {
    const connection = this.connectionRegistry.getConnection(socketId);
    if (!connection) {
      this.metrics.logger.error(
        `Connection missing for socket during event routing: ${event}`,
        { socketId }
      );
      throw createUnauthorizedError("Connection context missing");
    }

    this.connectionRegistry.updateActivity(socketId);

    try {
      switch (event) {
        case "driver:presence":
          await this.handleDriverPresence(connection, payload);
          break;
        case "driver:location":
          await this.handleDriverLocation(connection, payload);
          break;
        case "assignment:accept":
          await this.handleAssignmentAccept(connection, payload);
          break;
        case "assignment:reject":
          await this.handleAssignmentReject(connection, payload);
          break;
        case "session:subscribe":
          await this.handleSessionSubscribe(connection, payload);
          break;
        case "session:unsubscribe":
          await this.handleSessionUnsubscribe(connection, payload);
          break;
        case "tracking:subscribe":
          await this.handleTrackingSubscribe(connection, payload);
          break;
        case "tracking:unsubscribe":
          await this.handleTrackingUnsubscribe(connection, payload);
          break;
        case "subscription:resume":
          await this.handleSubscriptionResume(connection, payload);
          break;
        default:
          throw createInvalidArgumentError(
            `Unknown or unsupported client event: ${event}`
          );
      }
    } catch (err) {
      this.metrics.logger.error(
        `Validation or routing failure for event ${event}`,
        {
          socketId,
          driverId: connection.driverId,
          error: (err as Error).message,
        }
      );

      // Format clean MotusError response
      const clientError =
        err instanceof Error && "toMotusError" in err
          ? (err as any).toMotusError()
          : {
              code: ErrorCode.MOTUS_INVALID_ARGUMENT,
              message: (err as Error).message,
              timestamp: new Date().toISOString(),
            };

      connection.socket.emit("error", clientError);
      this.metrics.metrics.recordSocketError(
        connection.tenantId,
        clientError.code
      );
    }
  }

  // ─── Event Handlers ────────────────────────────────────────────────────────

  private async handleDriverPresence(
    connection: any,
    payload: any
  ): Promise<void> {
    const { driverId, tenantId } = connection;
    if (!driverId) {
      throw createUnauthorizedError("Only drivers can update presence state");
    }

    if (!payload || typeof payload.status !== "string") {
      throw createInvalidArgumentError("Missing required field: status");
    }

    this.metrics.logger.info(`Setting driver presence`, {
      driverId,
      status: payload.status,
    });

    switch (payload.status) {
      case "ONLINE":
        await this.driverNamespace.setDriverOnline(tenantId, driverId);
        break;
      case "OFFLINE":
        await this.driverNamespace.setDriverOffline(tenantId, driverId);
        break;
      case "PAUSED":
        await this.driverNamespace.setDriverPaused(tenantId, driverId);
        break;
      default:
        throw createInvalidArgumentError(
          `Invalid presence status: ${payload.status}`
        );
    }
  }

  private async handleDriverLocation(
    connection: any,
    payload: any
  ): Promise<void> {
    const { driverId, tenantId } = connection;
    if (!driverId) {
      throw createUnauthorizedError("Only drivers can stream locations");
    }

    if (
      !payload ||
      !payload.location ||
      typeof payload.location.latitude !== "number" ||
      typeof payload.location.longitude !== "number"
    ) {
      throw createInvalidArgumentError("Invalid coordinates payload");
    }

    // High frequency metrics record
    this.metrics.metrics.recordHeartbeat(tenantId, driverId);

    await this.driverNamespace.updateDriverLocation({
      tenantId,
      driverId,
      latitude: payload.location.latitude,
      longitude: payload.location.longitude,
      speed: payload.speed,
      bearing: payload.bearing,
      timestamp: payload.timestamp ?? new Date().toISOString(),
    });
  }

  private async handleAssignmentAccept(
    connection: any,
    payload: any
  ): Promise<void> {
    const { driverId, tenantId } = connection;
    if (!driverId) {
      throw createUnauthorizedError("Only drivers can accept assignments");
    }

    if (
      !payload ||
      !payload.sessionId ||
      typeof payload.waveNumber !== "number"
    ) {
      throw createInvalidArgumentError("Missing sessionId or waveNumber");
    }

    await this.driverNamespace.acceptSessionOffer(
      tenantId,
      driverId,
      payload.sessionId,
      payload.waveNumber
    );
  }

  private async handleAssignmentReject(
    connection: any,
    payload: any
  ): Promise<void> {
    const { driverId, tenantId } = connection;
    if (!driverId) {
      throw createUnauthorizedError("Only drivers can reject assignments");
    }

    if (
      !payload ||
      !payload.sessionId ||
      typeof payload.waveNumber !== "number"
    ) {
      throw createInvalidArgumentError("Missing sessionId or waveNumber");
    }

    await this.driverNamespace.rejectSessionOffer(
      tenantId,
      driverId,
      payload.sessionId,
      payload.waveNumber
    );
  }

  private async handleSessionSubscribe(
    connection: any,
    payload: any
  ): Promise<void> {
    const { socketId, tenantId, socket } = connection;
    if (!payload || !payload.sessionId) {
      throw createInvalidArgumentError("Missing required field: sessionId");
    }

    const room = this.roomManager.sessionRoom(payload.sessionId);
    const subscribed = this.subscriptionManager.subscribe(
      socketId,
      room,
      this.maxSubscriptionsPerSocket
    );
    if (subscribed) {
      await this.roomManager.joinRoom(socket, room, tenantId);
    }
  }

  private async handleSessionUnsubscribe(
    connection: any,
    payload: any
  ): Promise<void> {
    const { socketId, tenantId, socket } = connection;
    if (!payload || !payload.sessionId) {
      throw createInvalidArgumentError("Missing required field: sessionId");
    }

    const room = this.roomManager.sessionRoom(payload.sessionId);
    const removed = this.subscriptionManager.unsubscribe(socketId, room);
    if (removed) {
      await this.roomManager.leaveRoom(socket, room, tenantId);
    }
  }

  private async handleTrackingSubscribe(
    connection: any,
    payload: any
  ): Promise<void> {
    const { socketId, tenantId, socket } = connection;
    if (!payload || !payload.sessionId) {
      throw createInvalidArgumentError("Missing required field: sessionId");
    }

    const room = this.roomManager.trackingRoom(payload.sessionId);
    const subscribed = this.subscriptionManager.subscribe(
      socketId,
      room,
      this.maxSubscriptionsPerSocket
    );
    if (subscribed) {
      await this.roomManager.joinRoom(socket, room, tenantId);
    }
  }

  private async handleTrackingUnsubscribe(
    connection: any,
    payload: any
  ): Promise<void> {
    const { socketId, tenantId, socket } = connection;
    if (!payload || !payload.sessionId) {
      throw createInvalidArgumentError("Missing required field: sessionId");
    }

    const room = this.roomManager.trackingRoom(payload.sessionId);
    const removed = this.subscriptionManager.unsubscribe(socketId, room);
    if (removed) {
      await this.roomManager.leaveRoom(socket, room, tenantId);
    }
  }

  private async handleSubscriptionResume(
    connection: any,
    payload: any
  ): Promise<void> {
    const { socketId, tenantId, socket } = connection;
    if (!payload || !Array.isArray(payload.rooms)) {
      throw createInvalidArgumentError("Invalid rooms resume array");
    }

    const successfullyRecovered: string[] = [];
    for (const room of payload.rooms) {
      try {
        if (room.startsWith("tenant:")) {
          const roomTenantId = room.split(":")[1];
          if (roomTenantId !== tenantId) {
            continue; // Skip unauthorized
          }
        }
        const added = this.subscriptionManager.subscribe(
          socketId,
          room,
          this.maxSubscriptionsPerSocket
        );
        if (added) {
          await this.roomManager.joinRoom(socket, room, tenantId);
          successfullyRecovered.push(room);
        }
      } catch (err) {
        this.metrics.logger.warn(
          `Failed to recover subscription to room: ${room}`,
          err
        );
      }
    }

    socket.emit("subscription:recovered", { rooms: successfullyRecovered });
  }
}
