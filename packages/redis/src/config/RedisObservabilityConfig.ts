/**
 * Observability settings for logging, metrics, and tracing.
 */
export interface RedisObservabilityConfig {
  /** Record per-command latency via IRedisMetrics hooks. @default true */
  enableCommandLatencyMetrics: boolean;
  /** Minimum log level for Redis infrastructure log entries. @default 'info' */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  /** Wrap all public repository methods in ITracer spans. @default false */
  enableTracing: boolean;
  /**
   * Commands taking longer than this threshold in ms are logged at warn level.
   * @default 100
   */
  slowCommandThresholdMs: number;
}

/** Default observability config. */
export const DEFAULT_OBSERVABILITY_CONFIG: RedisObservabilityConfig = {
  enableCommandLatencyMetrics: true,
  logLevel: 'info',
  enableTracing: false,
  slowCommandThresholdMs: 100,
};
