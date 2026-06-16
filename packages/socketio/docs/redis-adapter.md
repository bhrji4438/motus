# Redis Adapter Configuration

The `@socket.io/redis-adapter` propagates WebSocket room memberships and broadcasts across multiple running Socket.IO instances.

## Configuration Setup

1. **Provide pub/sub Clients**: Pass two standalone or clustered `ioredis` instances (a primary connection and a dedicated subscriber connection) to the `redis` configuration block:

```typescript
import { SocketServer } from '@motus/socketio';
import { RedisClientManager } from '@motus/redis';

const redisManager = new RedisClientManager(redisConfig);
await redisManager.connect();

const server = new SocketServer({
  redis: {
    enabled: true,
    channelPrefix: 'motus_prod',
    pubClient: redisManager.client,
    subClient: redisManager.subscriberClient
  }
}, authenticator, driverNamespace);
```

2. **Network Protocol**: The adapter uses Redis `PUBLISH` and `SUBSCRIBE` commands on matching patterns (`channelPrefix:*`). Ensure that the Redis instance has pub/sub capability active and is not CPU-throttled.

---

## Redis Failure & Outage Recovery

If Redis goes offline, the `RedisAdapterManager` executes the following recovery loop:

1. **Detects Loss**: Close/error events from `pubClient`/`subClient` are intercepted.
2. **Local Fallback Mode**: The adapter degrades gracefully to in-memory mode. Handshakes are still accepted, and local node connections receive local broadcasts.
3. **Queue Telemetry**: Telemetry streams are preserved locally.
4. **Auto-reconnect Sync**: `ioredis` automatically tries to reconnect in the background. Once reconnected, the adapter is re-attached, and cluster-wide broadcasts resume.
