import { DriverId } from '@motus/types';
import { EventRouter } from '@/routing/EventRouter.js';
import { TransportAdapter } from '@/transport/TransportAdapter.js';
import { RoomManager } from '@/managers/RoomManager.js';

export class DriverGateway {
  constructor(
    private readonly transport: TransportAdapter,
    private readonly roomManager: RoomManager,
    private readonly eventRouter: EventRouter
  ) {}

  /**
   * Binds incoming driver socket event listeners.
   */
  public bindSocketEvents(socketId: string, socket: any): void {
    const events = ['driver:presence', 'driver:location', 'assignment:accept', 'assignment:reject'];

    for (const event of events) {
      socket.on(event, async (payload: any) => {
        await this.eventRouter.handleClientEvent(socketId, event, payload);
      });
    }
  }

  /**
   * Outbound: Sends an assignment offer wave notification directly to a driver's room.
   */
  public sendAssignmentOffer(driverId: DriverId, offerPayload: {
    sessionId: string;
    waveNumber: number;
    expiresAt: string;
  }): void {
    const room = this.roomManager.driverRoom(driverId);
    this.transport.broadcast(room, 'assignment:offer', offerPayload);
  }
}
