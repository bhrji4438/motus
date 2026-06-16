import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';

interface SseClient {
  tenantId: string;
  write: (data: string) => void;
  end: () => void;
}

interface WsClient {
  tenantId: string;
  ws: WebSocket;
}

export class RealtimeEngine {
  private wss?: WebSocketServer;
  private wsClients = new Set<WsClient>();
  private sseClients = new Set<SseClient>();

  /**
   * Bind WebSocket Server to a standard Node HTTP server or Fastify listener.
   */
  public attachServer(server: any): void {
    this.wss = new WebSocketServer({ noServer: true });

    // Handle WebSocket upgrade manually
    server.on('upgrade', (request: IncomingMessage, socket: any, head: any) => {
      const url = new URL(request.url || '', `http://${request.headers.host}`);
      if (url.pathname === '/dashboard/rt') {
        const tenantId = url.searchParams.get('tenantId') || 'unknown';
        this.wss?.handleUpgrade(request, socket, head, (ws) => {
          this.registerWsClient(ws, tenantId);
        });
      }
    });
  }

  private registerWsClient(ws: WebSocket, tenantId: string): void {
    const clientRecord: WsClient = { tenantId, ws };
    this.wsClients.add(clientRecord);

    ws.on('close', () => {
      this.wsClients.delete(clientRecord);
    });

    ws.on('error', () => {
      this.wsClients.delete(clientRecord);
    });

    // Send initial handshake acknowledgement
    ws.send(JSON.stringify({ event: 'rt.handshake', status: 'connected', tenantId }));
  }

  /**
   * Register a Server-Sent Events client path.
   */
  public registerSseClient(tenantId: string, writeFn: (data: string) => void, closeFn: () => void): SseClient {
    const clientRecord: SseClient = {
      tenantId,
      write: writeFn,
      end: closeFn,
    };
    this.sseClients.add(clientRecord);
    return clientRecord;
  }

  public removeSseClient(client: SseClient): void {
    this.sseClients.delete(client);
  }

  /**
   * Broadcast telemetry data to all active WS and SSE listeners matching the tenantId.
   */
  public broadcast(tenantId: string, eventName: string, payload: any): void {
    const message = JSON.stringify({ event: eventName, tenantId, payload, timestamp: new Date().toISOString() });

    // 1. Send via WebSocket
    for (const client of this.wsClients) {
      if (client.tenantId === tenantId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    }

    // 2. Send via SSE
    const sseFormattedData = `event: ${eventName}\ndata: ${message}\n\n`;
    for (const client of this.sseClients) {
      if (client.tenantId === tenantId) {
        client.write(sseFormattedData);
      }
    }
  }

  public getConnectedClientsCount(): { ws: number; sse: number } {
    return {
      ws: this.wsClients.size,
      sse: this.sseClients.size,
    };
  }
}

// Global default realtime engine
export const defaultRealtime = new RealtimeEngine();
export default defaultRealtime;
