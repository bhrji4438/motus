/**
 * Redis Streams consumer group settings and append retry policies.
 */
export interface RedisStreamsConfig {
  /** Consumer group name for telemetry stream processing. @default 'motus-telemetry' */
  telemetryConsumerGroup: string;
  /** Consumer group name for event stream processing. @default 'motus-events' */
  eventConsumerGroup: string;
  /**
   * Milliseconds a pending stream entry must be idle before it can be
   * re-claimed by another consumer (XCLAIM / XAUTOCLAIM). @default 60000
   */
  pendingEntryIdleMs: number;
  /** Maximum entries to read per XREADGROUP call. @default 100 */
  readBatchSize: number;
  /** Max XADD retry attempts for AT_LEAST_ONCE event appends. @default 3 */
  eventAppendMaxRetries: number;
  /** Base delay between XADD retry attempts in ms. @default 100 */
  eventAppendRetryDelayMs: number;
  /**
   * When true, telemetry XADD failures are silently dropped (AT_MOST_ONCE).
   * When false, they are retried up to eventAppendMaxRetries. @default true
   */
  telemetryDropOnFailure: boolean;
}

/** Default streams config. */
export const DEFAULT_STREAMS_CONFIG: RedisStreamsConfig = {
  telemetryConsumerGroup: "motus-telemetry",
  eventConsumerGroup: "motus-events",
  pendingEntryIdleMs: 60000,
  readBatchSize: 100,
  eventAppendMaxRetries: 3,
  eventAppendRetryDelayMs: 100,
  telemetryDropOnFailure: true,
};
