# API Reference - @motus/testing

This document details the builders, mock objects, and test containers of the `@motus/testing` package.

---

## 1. Entity Builders

Generate fully typed, syntactically valid domain structures for tests.

### `buildDriver(overrides?: Partial<Driver>): Driver`

Generates a mock driver profile.

### `buildSession(overrides?: Partial<Session>): Session`

Generates a mock dispatch session.

### `buildLocation(overrides?: Partial<Coordinate>): Coordinate`

Generates a location coordinate.

---

## 2. Redis Mocking Helpers

Test database commands without a local Docker daemon.

### `createMockRedisClient()`

Returns a fully mockable in-memory Redis client proxy that tracks geo indexes, keys, and values.

```typescript
import { createMockRedisClient } from "@motus/testing";
import { RedisGeoRepository } from "@motus/redis";

const mockRedis = createMockRedisClient();
const repository = new RedisGeoRepository(mockRedis);
```

---

## 3. Websocket Mocking Helpers

Simulate client heartbeats.

### `createMockSocketConnection()`

Returns a mocked socket emitter to verify room events.

```typescript
import { createMockSocketConnection } from "@motus/testing";

const mockSocket = createMockSocketConnection();
mockSocket.emit("location_update", { lat: 37, lng: -122 });
```
