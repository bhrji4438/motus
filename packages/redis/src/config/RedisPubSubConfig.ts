/**
 * Redis Pub/Sub behaviour and governance enforcement settings.
 */
export interface RedisPubSubConfig {
  /** Use PSUBSCRIBE (pattern matching) in addition to SUBSCRIBE. @default true */
  enablePatternSubscribe: boolean;
  /**
   * Maximum allowed message payload size in bytes.
   * Messages exceeding this are dropped with a warning. @default 1048576 (1 MB)
   */
  maxMessageSizeBytes: number;
  /** Channel name prefix for all Motus events. @default 'motus' */
  channelPrefix: string;
  /**
   * Validate full governance metadata on every received Pub/Sub message.
   * Malformed messages are dropped. @default true
   */
  enforceGovernanceOnReceive: boolean;
}

/** Default Pub/Sub config. */
export const DEFAULT_PUBSUB_CONFIG: RedisPubSubConfig = {
  enablePatternSubscribe: true,
  maxMessageSizeBytes: 1_048_576,
  channelPrefix: 'motus',
  enforceGovernanceOnReceive: true,
};
