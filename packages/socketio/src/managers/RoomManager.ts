import { TenantId, DriverId, SessionId } from "@motus/types";
import { MetricsManager } from "@/observability/MetricsManager.js";

export class RoomManager {
  constructor(private readonly metrics: MetricsManager) {}

  public tenantRoom(tenantId: TenantId): string {
    return `tenant:${tenantId}`;
  }

  public driverRoom(driverId: DriverId): string {
    return `driver:${driverId}`;
  }

  public sessionRoom(sessionId: SessionId): string {
    return `session:${sessionId}`;
  }

  public trackingRoom(sessionId: SessionId): string {
    return `tracking:${sessionId}`;
  }

  public async joinRoom(
    socket: any,
    room: string,
    tenantId: TenantId
  ): Promise<void> {
    await socket.join(room);
    const roomType = this.getRoomType(room);
    this.metrics.metrics.recordSubscription(tenantId, roomType);
    this.metrics.logger.debug(`Socket joined room`, {
      socketId: socket.id,
      room,
      tenantId,
    });
  }

  public async leaveRoom(
    socket: any,
    room: string,
    tenantId: TenantId
  ): Promise<void> {
    await socket.leave(room);
    const roomType = this.getRoomType(room);
    this.metrics.metrics.recordUnsubscription(tenantId, roomType);
    this.metrics.logger.debug(`Socket left room`, {
      socketId: socket.id,
      room,
      tenantId,
    });
  }

  private getRoomType(
    room: string
  ): "tenant" | "driver" | "session" | "tracking" {
    if (room.startsWith("tenant:")) return "tenant";
    if (room.startsWith("driver:")) return "driver";
    if (room.startsWith("session:")) return "session";
    if (room.startsWith("tracking:")) return "tracking";
    throw new Error(`Unknown room type for room: ${room}`);
  }
}
