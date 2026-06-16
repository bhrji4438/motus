import type { IAuthenticator } from "@motus/socketio";

/**
 * Ergonomic, developer-friendly configuration for Vectro.
 * Supports explicit configuration values, and falls back to environment variables.
 */
export interface VectroConfig {
  redis?: {
    /** Redis host. Defaults to REDIS_HOST or 'localhost'. */
    host?: string;
    /** Redis port. Defaults to REDIS_PORT or 6379. */
    port?: number;
    /** Redis password. Defaults to REDIS_PASSWORD or undefined. */
    password?: string;
    /** Redis database index. Defaults to REDIS_DB or 0. */
    db?: number;
    /** Redis connection mode. Defaults to 'standalone'. */
    mode?: "standalone" | "sentinel" | "cluster";
    /** Redis key prefix for shared keys and Pub/Sub channel prefixes. Defaults to 'vectro'. */
    keyPrefix?: string;
  };
  socketio?: {
    /** Port to start the Socket.IO server on. Defaults to undefined (does not start automatically if not set). */
    port?: number;
    /** Socket.IO gateway path. Defaults to '/socket.io'. */
    path?: string;
    /** Custom socket handshake authenticator. Defaults to a permissive developer authenticator. */
    authenticator?: IAuthenticator;
    /** Connection state recovery options. */
    connectionStateRecovery?: {
      enabled: boolean;
      maxConnectionDelayMs?: number;
    };
  };
}
