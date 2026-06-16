/**
 * Connection settings for standalone Redis mode.
 */
export interface RedisConnectionConfig {
  /** Redis mode — determines which additional config block is required. */
  mode: 'standalone' | 'sentinel' | 'cluster';
  /** Host for standalone mode. @default 'localhost' */
  host?: string;
  /** Port for standalone mode. @default 6379 */
  port?: number;
  /** Auth password for standalone/sentinel mode. */
  password?: string;
  /** Database index. Ignored in cluster mode. @default 0 */
  db?: number;
  /** TLS options passed directly to ioredis. */
  tls?: object;
  /** Connection timeout in milliseconds. @default 5000 */
  connectTimeoutMs: number;
  /** Per-command execution timeout in milliseconds. @default 2000 */
  commandTimeoutMs: number;
  /** Queue commands while disconnected and replay on reconnect. @default true */
  enableOfflineQueue: boolean;
  /** Max commands to hold in the offline queue. Excess commands fail immediately. @default 1000 */
  offlineQueueMaxLength: number;
}

/** Default standalone connection config. */
export const DEFAULT_CONNECTION_CONFIG: RedisConnectionConfig = {
  mode: 'standalone',
  host: 'localhost',
  port: 6379,
  db: 0,
  connectTimeoutMs: 5000,
  commandTimeoutMs: 2000,
  enableOfflineQueue: true,
  offlineQueueMaxLength: 1000,
};
