import { SessionId, Coordinates } from '@motus/types';
import { EventRouter } from '@/routing/EventRouter.js';
import { TransportAdapter } from '@/transport/TransportAdapter.js';
import { RoomManager } from '@/managers/RoomManager.js';

export class TrackingGateway {
  // session ID -> last broadcast timestamp
  private readonly lastBroadcastTime = new Map<SessionId, number>();
  // session ID -> last broadcast coordinates
  private readonly lastCoordinates = new Map<SessionId, Coordinates>();

  constructor(
    private readonly transport: TransportAdapter,
    private readonly roomManager: RoomManager,
    private readonly eventRouter: EventRouter,
    private readonly minDistanceMeters: number = 2.0, // 2-meter decimation
    private readonly minIntervalMs: number = 1000,    // 1Hz throttling
    private readonly forceIntervalMs: number = 10000   // Force update every 10s regardless of distance
  ) {}

  /**
   * Binds incoming session tracking events.
   */
  public bindSocketEvents(socketId: string, socket: any): void {
    const events = ['tracking:subscribe', 'tracking:unsubscribe'];

    for (const event of events) {
      socket.on(event, async (payload: any) => {
        await this.eventRouter.handleClientEvent(socketId, event, payload);
      });
    }
  }

  /**
   * Outbound: Streams high-frequency coordinate/telemetry updates to the tracking room.
   * Optimizes CPU/bandwidth using temporal rate-limiting and spatial decimation.
   */
  public broadcastTrackingUpdate(sessionId: SessionId, payload: {
    location: Coordinates;
    speed?: number;
    bearing?: number;
    timestamp: string;
  }): boolean {
    const now = Date.now();
    const lastTime = this.lastBroadcastTime.get(sessionId) ?? 0;
    const elapsed = now - lastTime;

    // 1. Temporal throttling (Max 1Hz)
    if (elapsed < this.minIntervalMs) {
      return false; // Dropped by time throttle
    }

    const lastCoords = this.lastCoordinates.get(sessionId);
    const newCoords = payload.location;

    // 2. Spatial Decimation (skip if moved < 2m, unless forced update threshold met)
    if (lastCoords && elapsed < this.forceIntervalMs) {
      const distance = this.calculateDistance(
        lastCoords.latitude,
        lastCoords.longitude,
        newCoords.latitude,
        newCoords.longitude
      );
      if (distance < this.minDistanceMeters) {
        return false; // Dropped by distance decimation
      }
    }

    // 3. Execute Broadcast
    const room = this.roomManager.trackingRoom(sessionId);
    this.transport.broadcast(room, 'tracking:update', payload);

    // Save states
    this.lastBroadcastTime.set(sessionId, now);
    this.lastCoordinates.set(sessionId, newCoords);
    return true;
  }

  public clearSessionState(sessionId: SessionId): void {
    this.lastBroadcastTime.delete(sessionId);
    this.lastCoordinates.delete(sessionId);
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi/2) +
      Math.cos(phi1) *
        Math.cos(phi2) *
        Math.sin(deltaLambda / 2) *
        Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }
}
