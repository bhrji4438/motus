/**
 * Core server configurations for HTTP and log routing.
 */
export interface ServerConfig {
  readonly port: number;
  readonly host: string;
  readonly jwtSecret: string;
  readonly logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Connection pool and cluster configurations for Redis state managers.
 */
export interface RedisConfig {
  /**
   * Comma-separated list of host:port configurations.
   */
  readonly nodes: readonly string[];
  readonly password?: string;
  readonly clusterMode: boolean;
  readonly maxConnections: number;
}

/**
 * Timeout and ingress parameters for the Socket.IO gateway.
 */
export interface SocketConfig {
  readonly path: string;
  readonly pingInterval: number;
  readonly pingTimeout: number;
}

/**
 * Filter and data lifetime parameters for telemetry stream collections.
 */
export interface TelemetryConfig {
  readonly sampleDistanceMeters: number;
  readonly sampleIntervalSeconds: number;
  readonly streamTtlSeconds: number;
}

/**
 * Default search boundaries and strategy algorithms for candidate scoring.
 */
export interface MatchingConfig {
  readonly defaultStrategy: 'distance' | 'eta';
  readonly initialRadiusMeters: number;
  readonly maxRadiusMeters: number;
}

/**
 * Notification batch and window timeouts for offer distributions.
 */
export interface FanoutConfig {
  readonly waveSize: number;
  readonly waveTimeoutSeconds: number;
}
