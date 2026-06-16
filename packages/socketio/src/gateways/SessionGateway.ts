import { SessionId } from "@motus/types";
import { EventRouter } from "@/routing/EventRouter.js";
import { TransportAdapter } from "@/transport/TransportAdapter.js";
import { RoomManager } from "@/managers/RoomManager.js";

export class SessionGateway {
  constructor(
    private readonly transport: TransportAdapter,
    private readonly roomManager: RoomManager,
    private readonly eventRouter: EventRouter
  ) {}

  /**
   * Binds incoming session subscription and state listeners.
   */
  public bindSocketEvents(socketId: string, socket: any): void {
    const events = [
      "session:subscribe",
      "session:unsubscribe",
      "subscription:resume",
    ];

    for (const event of events) {
      socket.on(event, async (payload: any) => {
        await this.eventRouter.handleClientEvent(socketId, event, payload);
      });
    }
  }

  /**
   * Outbound: Broadcasts a session status update/lifecycle transition to the session room.
   */
  public broadcastSessionEvent(
    sessionId: SessionId,
    eventName: string,
    payload: any
  ): void {
    const room = this.roomManager.sessionRoom(sessionId);
    this.transport.broadcast(room, `session:${eventName}`, payload);
  }
}
