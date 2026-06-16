import { RoomManager } from "@/managers/RoomManager.js";
import { SubscriptionManager } from "@/managers/SubscriptionManager.js";
import { ConnectionRegistry } from "@/managers/ConnectionRegistry.js";
import { MetricsManager } from "@/observability/MetricsManager.js";
import { createUnauthorizedError } from "@/errors/errors.js";

export class RecoveryManager {
  constructor(
    private readonly roomManager: RoomManager,
    private readonly subscriptionManager: SubscriptionManager,
    private readonly connectionRegistry: ConnectionRegistry,
    private readonly metrics: MetricsManager
  ) {}

  /**
   * Recovers subscriptions for a client socket that has reconnected.
   * Compares requested rooms to make sure they match client tenantId.
   */
  public async recoverSubscriptions(
    socketId: string,
    rooms: readonly string[],
    maxSubscriptions: number
  ): Promise<string[]> {
    const connection = this.connectionRegistry.getConnection(socketId);
    if (!connection) {
      throw createUnauthorizedError("Connection context missing for recovery");
    }

    const { tenantId, socket } = connection;
    const successfullyRecovered: string[] = [];

    this.metrics.logger.info(`Starting subscription recovery`, {
      socketId,
      tenantId,
      requestedCount: rooms.length,
    });

    for (const room of rooms) {
      try {
        // Enforce tenant isolation during recovery
        this.validateRoomTenantAccess(room, tenantId);

        // Add to subscription tracking (deduplicating and checking limits)
        const added = this.subscriptionManager.subscribe(
          socketId,
          room,
          maxSubscriptions
        );
        if (added) {
          await this.roomManager.joinRoom(socket, room, tenantId);
          successfullyRecovered.push(room);
        }
      } catch (err) {
        this.metrics.logger.warn(`Failed to recover subscription to room`, {
          socketId,
          room,
          error: (err as Error).message,
        });
      }
    }

    this.metrics.logger.info(`Subscription recovery finished`, {
      socketId,
      tenantId,
      recoveredCount: successfullyRecovered.length,
    });

    return successfullyRecovered;
  }

  private validateRoomTenantAccess(room: string, tenantId: string): void {
    // Rooms are formatted as: tenant:{tenantId}, driver:{driverId}, session:{sessionId}, tracking:{sessionId}
    // For session and tracking rooms, we can verify that the socket has authorization for that tenant.
    // Since we don't have direct session-to-tenant mapping loaded in this transport layer,
    // we make sure that the client isn't attempting to join raw tenant rooms of other tenants.
    if (room.startsWith("tenant:")) {
      const roomTenantId = room.split(":")[1];
      if (roomTenantId !== tenantId) {
        throw createUnauthorizedError(
          `Cannot join room belonging to another tenant: ${room}`
        );
      }
    }
    // Custom checks could go here (e.g. querying session repository via core to check tenant, if required).
  }
}
