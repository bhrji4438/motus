import { io as clientIo, type Socket as ClientSocket } from "socket.io-client";

export interface SocketConnectionOptions {
  port: number;
  token: string;
  tenantId: string;
  query?: Record<string, string>;
}

/**
 * Creates and connects a Socket.IO client, returning a promise that resolves
 * when the socket connects, or rejects if a connection error occurs.
 */
export function connectSocketClient(
  options: SocketConnectionOptions
): Promise<ClientSocket> {
  const { port, token, tenantId, query = {} } = options;
  return new Promise((resolve, reject) => {
    const client = clientIo(`http://localhost:${port}`, {
      auth: { token, tenantId },
      query: { tenantId, ...query },
      transports: ["websocket"],
      forceNew: true,
    });

    client.on("connect", () => {
      resolve(client);
    });

    client.on("connect_error", (err) => {
      client.close();
      reject(err);
    });
  });
}

/**
 * Helper to wait for a specific event from a Socket.IO client within a timeout period.
 */
export function waitForSocketEvent<T>(
  socket: ClientSocket,
  eventName: string,
  timeoutMs = 5000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(eventName, handler);
      reject(new Error(`Timed out waiting for socket event: ${eventName}`));
    }, timeoutMs);

    const handler = (payload: T) => {
      clearTimeout(timeout);
      socket.off(eventName, handler);
      resolve(payload);
    };

    socket.on(eventName, handler);
  });
}
