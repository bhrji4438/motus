# @motus/redis

Redis infrastructure layer for the Motus real-time dispatch and tracking platform.

Provides highly robust, multi-tenant separated, event-driven persistence and coordination abstractions matching the ports defined in `@motus/core`.

---

## Features

- **Strict Multi-Tenant Separation**: All keys are formatted with `{tenantId}` as the Redis Cluster hash tag, ensuring all keys for a single tenant reside on the same cluster slot for atomic Lua operations.
- **Robust Locking & Concurrency (`ILockManager`)**: Implements Redlock-style distributed mutual exclusion with deterministic token ownership, heartbeat renewal, retry strategies, and automatic lock janitors.
- **Robust Event & Telemetry Stream Persistence**: AT_LEAST_ONCE delivery guarantees for events (with retries and XADD) and high-throughput AT_MOST_ONCE delivery for telemetry logs.
- **Lua-Backed Atomic Workflows**: Safe state transition operations, driver state changes, spatial indexing (GEOADD), and presence tracking in a single round-trip.
- **Event Governance**: Enforces schema versions, ordering scopes, partition keys, and metadata validations.
- **Self-Healing Cleanup Workers**: Independent background cron loops for lock pruning, telemetry retention, event trimming, and presence expiry.

---

## Directory Structure

```
src/
├── client/          # Connection manager for standalone/cluster/sentinel client
├── config/          # Decoupled config modules (connection, retry, lock, retention...)
├── keys/            # KeyFactory ensuring uniform slot constraints
├── serialization/   # Type-safe serializers with schema compatibility checks
├── scripts/         # Lua script registry and atomic runner
├── guards/          # Structural validation for IDs and tokens
├── governance/      # Event schema validation and governance checks
├── observability/   # Integrated log, metric, and tracer wrappers
├── repositories/    # Redis-backed ports (Tenant, Driver, Session, Event, Telemetry...)
├── adapters/        # EventBus & Streams interface adapters
├── services/        # Background maintenance workers (janitor, pruner, trimmer)
└── index.ts         # Public barrel file
```

---

## Configuration

The module is configured using the `MotusRedisConfig` object, which is divided into sub-configurations:

1. **`RedisConnectionConfig`**: Standalone / Cluster / Sentinel configurations.
2. **`RedisRetryConfig`**: Redis reconnection retry backoff strategy.
3. **`RedisLockConfig`**: Lock acquisition parameters (TTLs, retries, jitter).
4. **`RedisRetentionConfig`**: Retention TTLs for telemetry, sessions, and events.
5. **`RedisCleanupConfig`**: Background cleaning loop execution intervals.
6. **`RedisStreamsConfig`**: Stream consumer group names, batch limits, and retries.
7. **`RedisObservabilityConfig`**: Observability tags and feature toggles.

---

## Verification

Run all test suites locally:

```bash
# Start Docker / Docker Desktop first
npm run test
```

Includes unit testing for serializers, key formatting, and full integration tests against real Dockerized Redis instances using `testcontainers`.
