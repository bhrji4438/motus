/**
 * Cleanup service worker job intervals and batch limits.
 */
export interface RedisCleanupConfig {
  /** Session expiry scan interval in seconds. @default 60 */
  sessionExpiryIntervalSeconds: number;
  /** Telemetry stream trim interval in seconds. @default 300 */
  telemetryRetentionIntervalSeconds: number;
  /** Event stream trim interval in seconds. @default 300 */
  eventRetentionIntervalSeconds: number;
  /** Stale presence cleanup scan interval in seconds. @default 120 */
  presenceCleanupIntervalSeconds: number;
  /** Lock janitor scan interval in seconds. @default 600 */
  lockJanitorIntervalSeconds: number;
  /** Seconds without heartbeat before a driver is considered stale. @default 120 */
  staleDriverThresholdSeconds: number;
  /** Maximum sessions to prune per cleanup batch to avoid long Redis blocks. @default 100 */
  cleanupBatchSize: number;
  /** Whether the cleanup service is enabled. @default true */
  enabled: boolean;
}

/** Default cleanup config. */
export const DEFAULT_CLEANUP_CONFIG: RedisCleanupConfig = {
  sessionExpiryIntervalSeconds: 60,
  telemetryRetentionIntervalSeconds: 300,
  eventRetentionIntervalSeconds: 300,
  presenceCleanupIntervalSeconds: 120,
  lockJanitorIntervalSeconds: 600,
  staleDriverThresholdSeconds: 120,
  cleanupBatchSize: 100,
  enabled: true,
};
