export interface TransportAdapter {
  start(): Promise<void>;
  stop(): Promise<void>;
  broadcast(room: string, event: string, payload: any): void;
  broadcastToTenant(tenantId: string, event: string, payload: any): void;
  emitToDriver(driverId: string, event: string, payload: any): void;
  onClientEvent(event: string, handler: (socketId: string, payload: any) => Promise<void> | void): void;
  disconnectClient(socketId: string, closeUnderlying?: boolean): void;
}
