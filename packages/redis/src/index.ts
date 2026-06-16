/**
 * @motus/redis — Redis infrastructure layer for the Motus platform.
 *
 * Package boundary:
 * - May depend on: @motus/types, @motus/core (interfaces only), ioredis
 * - Must NOT depend on: @motus/server, @motus/sdk, Socket.IO, Express, HTTP frameworks
 */

// ─── Configuration ──────────────────────────────────────────────────────────
export type {
  MotusRedisConfig,
  RedisConnectionConfig,
  RedisClusterConfig,
  RedisClusterNode,
  RedisSentinelConfig,
  RedisSentinelNode,
  RedisRetryConfig,
  RedisLockConfig,
  RedisRetentionConfig,
  RedisCleanupConfig,
  RedisPubSubConfig,
  RedisStreamsConfig,
  RedisObservabilityConfig,
} from "@/config/index.js";

export {
  DEFAULT_MOTUS_REDIS_CONFIG,
  DEFAULT_CONNECTION_CONFIG,
  DEFAULT_CLUSTER_CONFIG,
  DEFAULT_SENTINEL_CONFIG,
  DEFAULT_RETRY_CONFIG,
  DEFAULT_LOCK_CONFIG,
  DEFAULT_RETENTION_CONFIG,
  DEFAULT_CLEANUP_CONFIG,
  DEFAULT_PUBSUB_CONFIG,
  DEFAULT_STREAMS_CONFIG,
  DEFAULT_OBSERVABILITY_CONFIG,
} from "@/config/index.js";

// ─── Client Manager ──────────────────────────────────────────────────────────
export { RedisClientManager } from "@/client/RedisClientManager.js";
export type { RedisClient } from "@/client/RedisClientManager.js";

// ─── Keys ────────────────────────────────────────────────────────────────────
export { KeyFactory } from "@/keys/index.js";

// ─── Serialization ───────────────────────────────────────────────────────────
export {
  TenantSerializer,
  DriverSerializer,
  SessionSerializer,
  TelemetrySerializer,
  EventStreamSerializer,
  RedisSchemaVersionError,
} from "@/serialization/index.js";

// ─── Guards ──────────────────────────────────────────────────────────────────
export { TenantGuard } from "@/guards/TenantGuard.js";

// ─── Governance ──────────────────────────────────────────────────────────────
export { EventGovernanceValidator } from "@/governance/EventGovernanceValidator.js";

// ─── Observability ───────────────────────────────────────────────────────────
export type {
  IRedisMetrics,
  RedisObservabilityDeps,
  ResolvedObservability,
} from "@/observability/RedisObservability.js";
export {
  NoopMetrics,
  NoopTracer,
  NoopLogger,
  resolveObservability,
  withObservability,
} from "@/observability/RedisObservability.js";

// ─── Repositories ────────────────────────────────────────────────────────────
export { RedisTenantRepository } from "@/repositories/RedisTenantRepository.js";
export { RedisDriverRepository } from "@/repositories/RedisDriverRepository.js";
export { RedisSessionRepository } from "@/repositories/RedisSessionRepository.js";
export { RedisGeoRepository } from "@/repositories/RedisGeoRepository.js";
export type { GeoSearchResult } from "@/repositories/RedisGeoRepository.js";
export { RedisPresenceRepository } from "@/repositories/RedisPresenceRepository.js";
export type { PresenceEntry } from "@/repositories/RedisPresenceRepository.js";
export { RedisEventRepository } from "@/repositories/RedisEventRepository.js";
export type { GetEventsOptions } from "@/repositories/RedisEventRepository.js";
export { RedisTelemetryRepository } from "@/repositories/RedisTelemetryRepository.js";
export type { GetTelemetryOptions } from "@/repositories/RedisTelemetryRepository.js";
export { RedisLockManager } from "@/repositories/RedisLockManager.js";
export type { LockHandle } from "@/repositories/RedisLockManager.js";

// ─── Adapters ────────────────────────────────────────────────────────────────
export { RedisStreamsAdapter } from "@/adapters/RedisStreamsAdapter.js";
export type {
  StreamEntry,
  ConsumerGroupReadOptions,
} from "@/adapters/RedisStreamsAdapter.js";
export { RedisEventBus } from "@/adapters/RedisEventBus.js";

// ─── Services ────────────────────────────────────────────────────────────────
export { RedisCleanupService } from "@/services/RedisCleanupService.js";

// ─── Scripts ─────────────────────────────────────────────────────────────────
export { LuaScriptRegistry } from "@/scripts/LuaScriptRegistry.js";
