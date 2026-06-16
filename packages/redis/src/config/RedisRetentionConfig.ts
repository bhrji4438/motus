/**
 * Data retention limits controlling stream sizes and session longevity.
 */
export interface RedisRetentionConfig {
  /** Seconds to retain terminal session data before pruning. @default 604800 (7 days) */
  sessionRetentionSeconds: number;
  /** Maximum telemetry points kept per session stream (XTRIM MAXLEN). @default 10000 */
  telemetryMaxPoints: number;
  /** Maximum event entries kept per session stream (XTRIM MAXLEN). @default 5000 */
  eventMaxEntries: number;
  /** Seconds to retain event/telemetry streams after session termination. @default 604800 (7 days) */
  eventStreamRetentionSeconds: number;
}

/** Default retention config. */
export const DEFAULT_RETENTION_CONFIG: RedisRetentionConfig = {
  sessionRetentionSeconds: 604800,
  telemetryMaxPoints: 10000,
  eventMaxEntries: 5000,
  eventStreamRetentionSeconds: 604800,
};
