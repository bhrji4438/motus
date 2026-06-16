/** A single Redis Cluster seed node. */
export interface RedisClusterNode {
  host: string;
  port: number;
}

/**
 * Configuration for Redis Cluster mode.
 * Required when RedisConnectionConfig.mode === 'cluster'.
 */
export interface RedisClusterConfig {
  /** Seed nodes for cluster discovery. At least one must be reachable. */
  nodes: RedisClusterNode[];
  /** Max MOVED/ASK redirect retries per command. @default 16 */
  maxRedirections: number;
  /** Interval between automatic slot map refreshes in ms. @default 5000 */
  slotsRefreshIntervalMs: number;
  /** Per-command timeout in ms. @default 2000 */
  commandTimeoutMs: number;
  /** Cluster-wide auth password. @default undefined */
  password?: string;
  /** TLS options for cluster connections. */
  tls?: object;
}

/** Default Redis Cluster config. */
export const DEFAULT_CLUSTER_CONFIG: RedisClusterConfig = {
  nodes: [{ host: "localhost", port: 6379 }],
  maxRedirections: 16,
  slotsRefreshIntervalMs: 5000,
  commandTimeoutMs: 2000,
};
