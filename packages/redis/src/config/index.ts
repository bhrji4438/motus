export type { RedisConnectionConfig } from "@/config/RedisConnectionConfig.js";
export { DEFAULT_CONNECTION_CONFIG } from "@/config/RedisConnectionConfig.js";

export type {
  RedisClusterConfig,
  RedisClusterNode,
} from "@/config/RedisClusterConfig.js";
export { DEFAULT_CLUSTER_CONFIG } from "@/config/RedisClusterConfig.js";

export type {
  RedisSentinelConfig,
  RedisSentinelNode,
} from "@/config/RedisSentinelConfig.js";
export { DEFAULT_SENTINEL_CONFIG } from "@/config/RedisSentinelConfig.js";

export type { RedisRetryConfig } from "@/config/RedisRetryConfig.js";
export { DEFAULT_RETRY_CONFIG } from "@/config/RedisRetryConfig.js";

export type { RedisLockConfig } from "@/config/RedisLockConfig.js";
export { DEFAULT_LOCK_CONFIG } from "@/config/RedisLockConfig.js";

export type { RedisRetentionConfig } from "@/config/RedisRetentionConfig.js";
export { DEFAULT_RETENTION_CONFIG } from "@/config/RedisRetentionConfig.js";

export type { RedisCleanupConfig } from "@/config/RedisCleanupConfig.js";
export { DEFAULT_CLEANUP_CONFIG } from "@/config/RedisCleanupConfig.js";

export type { RedisPubSubConfig } from "@/config/RedisPubSubConfig.js";
export { DEFAULT_PUBSUB_CONFIG } from "@/config/RedisPubSubConfig.js";

export type { RedisStreamsConfig } from "@/config/RedisStreamsConfig.js";
export { DEFAULT_STREAMS_CONFIG } from "@/config/RedisStreamsConfig.js";

export type { RedisObservabilityConfig } from "@/config/RedisObservabilityConfig.js";
export { DEFAULT_OBSERVABILITY_CONFIG } from "@/config/RedisObservabilityConfig.js";

import type { RedisConnectionConfig } from "@/config/RedisConnectionConfig.js";
import type { RedisClusterConfig } from "@/config/RedisClusterConfig.js";
import type { RedisSentinelConfig } from "@/config/RedisSentinelConfig.js";
import type { RedisRetryConfig } from "@/config/RedisRetryConfig.js";
import type { RedisLockConfig } from "@/config/RedisLockConfig.js";
import type { RedisRetentionConfig } from "@/config/RedisRetentionConfig.js";
import type { RedisCleanupConfig } from "@/config/RedisCleanupConfig.js";
import type { RedisPubSubConfig } from "@/config/RedisPubSubConfig.js";
import type { RedisStreamsConfig } from "@/config/RedisStreamsConfig.js";
import type { RedisObservabilityConfig } from "@/config/RedisObservabilityConfig.js";
import { DEFAULT_CONNECTION_CONFIG } from "@/config/RedisConnectionConfig.js";
import { DEFAULT_RETRY_CONFIG } from "@/config/RedisRetryConfig.js";
import { DEFAULT_LOCK_CONFIG } from "@/config/RedisLockConfig.js";
import { DEFAULT_RETENTION_CONFIG } from "@/config/RedisRetentionConfig.js";
import { DEFAULT_CLEANUP_CONFIG } from "@/config/RedisCleanupConfig.js";
import { DEFAULT_PUBSUB_CONFIG } from "@/config/RedisPubSubConfig.js";
import { DEFAULT_STREAMS_CONFIG } from "@/config/RedisStreamsConfig.js";
import { DEFAULT_OBSERVABILITY_CONFIG } from "@/config/RedisObservabilityConfig.js";

/**
 * Umbrella configuration composing all Motus Redis sub-configs.
 * Pass this to RedisClientManager to instantiate the full infrastructure layer.
 */
export interface MotusRedisConfig {
  connection: RedisConnectionConfig;
  /** Required when connection.mode === 'cluster'. */
  cluster?: RedisClusterConfig;
  /** Required when connection.mode === 'sentinel'. */
  sentinel?: RedisSentinelConfig;
  retry: RedisRetryConfig;
  lock: RedisLockConfig;
  retention: RedisRetentionConfig;
  cleanup: RedisCleanupConfig;
  pubsub: RedisPubSubConfig;
  streams: RedisStreamsConfig;
  observability: RedisObservabilityConfig;
}

/** Production-ready default configuration for standalone Redis. */
export const DEFAULT_MOTUS_REDIS_CONFIG: MotusRedisConfig = {
  connection: DEFAULT_CONNECTION_CONFIG,
  retry: DEFAULT_RETRY_CONFIG,
  lock: DEFAULT_LOCK_CONFIG,
  retention: DEFAULT_RETENTION_CONFIG,
  cleanup: DEFAULT_CLEANUP_CONFIG,
  pubsub: DEFAULT_PUBSUB_CONFIG,
  streams: DEFAULT_STREAMS_CONFIG,
  observability: DEFAULT_OBSERVABILITY_CONFIG,
};
