/** A single Redis Sentinel node address. */
export interface RedisSentinelNode {
  host: string;
  port: number;
}

/**
 * Configuration for Redis Sentinel mode.
 * Required when RedisConnectionConfig.mode === 'sentinel'.
 */
export interface RedisSentinelConfig {
  /** Sentinel node addresses. At least one must be reachable. */
  sentinels: RedisSentinelNode[];
  /** Name of the monitored Redis master as declared in sentinel.conf. */
  name: string;
  /** Auth password for the Sentinel instances themselves. */
  sentinelPassword?: string;
  /** Auth password for the Redis primary instance. */
  password?: string;
  /** Database index on the primary. @default 0 */
  db?: number;
  /**
   * How long to wait for failover detection before treating the primary as
   * unavailable and re-querying sentinels. In ms. @default 10000
   */
  failoverDetectionTimeoutMs: number;
}

/** Default Sentinel config. */
export const DEFAULT_SENTINEL_CONFIG: RedisSentinelConfig = {
  sentinels: [{ host: 'localhost', port: 26379 }],
  name: 'mymaster',
  failoverDetectionTimeoutMs: 10000,
};
