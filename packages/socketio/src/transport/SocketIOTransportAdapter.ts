import { Server as SocketIOServer } from 'socket.io';
import { TransportAdapter } from '@/transport/TransportAdapter.js';
import { MetricsManager } from '@/observability/MetricsManager.js';
import { RoomManager } from '@/managers/RoomManager.js';

export class SocketIOTransportAdapter implements TransportAdapter {
  private clientHandlers = new Map<string, Set<(socketId: string, payload: any) => Promise<void> | void>>();

  constructor(
    public readonly io: SocketIOServer,
    private readonly roomManager: RoomManager,
    private readonly metrics: MetricsManager,
    private readonly port?: number
  ) {}

  public async start(): Promise<void> {
    if (this.port !== undefined) {
      this.io.attach(this.port);
      this.metrics.logger.info(`Socket.IO Server attached to port ${this.port}`);
    }
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.io.close(() => {
        this.metrics.logger.info('Socket.IO Server closed.');
        resolve();
      });
    });
  }

  public broadcast(room: string, event: string, payload: any): void {
    const serialized = JSON.stringify(payload);
    const sizeBytes = Buffer.byteLength(serialized, 'utf8');

    this.io.to(room).emit(event, payload);
    this.metrics.metrics.recordBroadcast(room, event);
    this.metrics.metrics.recordMessageSent(event, sizeBytes);
  }

  public broadcastToTenant(tenantId: string, event: string, payload: any): void {
    const room = this.roomManager.tenantRoom(tenantId);
    this.broadcast(room, event, payload);
  }

  public emitToDriver(driverId: string, event: string, payload: any): void {
    const room = this.roomManager.driverRoom(driverId);
    this.broadcast(room, event, payload);
  }

  public onClientEvent(event: string, handler: (socketId: string, payload: any) => Promise<void> | void): void {
    if (!this.clientHandlers.has(event)) {
      this.clientHandlers.set(event, new Set());
    }
    this.clientHandlers.get(event)!.add(handler);
  }

  public disconnectClient(socketId: string, closeUnderlying: boolean = true): void {
    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.disconnect(closeUnderlying);
      this.metrics.logger.debug(`Forced disconnect on socket`, { socketId });
    }
  }

  // Internal helper to propagate events intercepted at connection level
  public async handleSocketEvent(socketId: string, event: string, payload: any): Promise<void> {
    const handlers = this.clientHandlers.get(event);
    if (!handlers) return;

    const promises = Array.from(handlers).map(async (handler) => {
      try {
        const serialized = JSON.stringify(payload);
        this.metrics.metrics.recordMessageReceived(event, Buffer.byteLength(serialized, 'utf8'));
        await handler(socketId, payload);
      } catch (err) {
        this.metrics.logger.error(`Error executing handler for client event: ${event}`, err);
      }
    });

    await Promise.all(promises);
  }
}
