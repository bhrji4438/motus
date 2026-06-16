# @motus/redis

Redis persistence, caching, and stream event adapter for the Vectro platform.

---

## 1. Purpose

Provides low-latency state persistence, geospatial indexing of active driver coordinates, atomic mutex locking (Redlock), and Redis Streams pub/sub event buffers for the Vectro core.

---

## 2. Installation

```bash
npm install @motus/redis ioredis
```

---

## 3. Quick Start

```typescript
import Redis from "ioredis";
import { RedisClientManager, RedisDriverRepository } from "@motus/redis";

const redis = new Redis("redis://127.0.0.1:6379");
const clientManager = new RedisClientManager(redis);
const repository = new RedisDriverRepository(clientManager);
```

---

## 4. Configuration

Supports Standalone, Redis Cluster, and Sentinel connections. Configure parameters using standard `MotusRedisConfig` schemas:

- `REDIS_MODE=cluster`
- `REDIS_NODES=node-1:6379,node-2:6379`

---

## 5. Common Use Cases

- Saving and querying driver presence hashes.
- Querying nearby drivers using geospatial sets.
- Managing wave concurrency locks using `RedisLockManager`.
- Asynchronously publishing events to Redis streams.

---

## 6. API Reference Link

- [API Reference: @motus/redis](../../docs/api-reference/redis.md)

---

## 7. Related Modules

- `@motus/core` — Business rules and ports interface.
- `@motus/types` — Serialized domain entities.

---

## 8. Production Notes

Always set the eviction policy to `noeviction` in your production Redis clusters to prevent active session data loss.

---

## 9. Limitations

Must not depend on HTTP server frameworks or websocket listeners. Multi-key Lua operations must wrap keys in hashtag brackets (`{tenantId}`) to prevent cluster cross-slot errors.

---

## 10. Examples

Detailed repository and serialization examples can be found in the [Redis API Reference Page](../../docs/api-reference/redis.md).
