# API Reference - @motus/redis

This document details the classes, interfaces, and repositories of the `@motus/redis` package.

---

## 1. Class: RedisClientManager

Manages standard connection, cluster, and Sentinel connections.

```typescript
export class RedisClientManager {
  constructor(config: MotusRedisConfig);
  public async connect(): Promise<void>;
  public async disconnect(): Promise<void>;
  public isConnected(): boolean;
  get client(): RedisClient; // Returns primary ioredis client
  get subscriberClient(): Redis; // Returns subscriber connection
}
```

---

## 2. Repositories

All repositories consume `RedisClient` and enforce multi-tenant separation.

### A. RedisTenantRepository

```typescript
class RedisTenantRepository {
  constructor(client: RedisClient);
  public async saveTenant(tenant: Tenant): Promise<void>;
  public async getTenant(tenantId: TenantId): Promise<Tenant | null>;
}
```

### B. RedisDriverRepository

```typescript
class RedisDriverRepository {
  constructor(client: RedisClient);
  public async saveDriver(driver: Driver): Promise<void>;
  public async getDriver(
    tenantId: TenantId,
    driverId: DriverId
  ): Promise<Driver | null>;
}
```

### C. RedisSessionRepository

```typescript
class RedisSessionRepository {
  constructor(client: RedisClient, retentionConfig?: RedisRetentionConfig);
  public async saveSession(session: Session): Promise<void>;
  public async get(
    tenantId: TenantId,
    sessionId: SessionId
  ): Promise<Session | null>;
}
```

### D. RedisGeoRepository

```typescript
class RedisGeoRepository {
  constructor(client: RedisClient);
  public async updateLocation(
    tenantId: TenantId,
    driverId: DriverId,
    coord: Coordinates
  ): Promise<void>;
  public async searchNearby(
    tenantId: TenantId,
    coord: Coordinates,
    radiusMeters: number
  ): Promise<GeoSearchResult[]>;
  public async removeLocation(
    tenantId: TenantId,
    driverId: DriverId
  ): Promise<void>;
}
```

---

## 3. Class: RedisLockManager

Implements distributed lock algorithms.

```typescript
class RedisLockManager {
  constructor(client: RedisClient, lockConfig?: RedisLockConfig);
  public async acquireLock(key: string, ttlSeconds?: number): Promise<boolean>;
  public async releaseLock(key: string): Promise<void>;
  public async acquireLockWithHandle(
    resourceId: string,
    ttlMs?: number
  ): Promise<LockHandle | null>;
  public async releaseLockHandle(handle: LockHandle): Promise<void>;
  public startRenewal(handle: LockHandle): void;
}
```

- **Safety**: Validates token value matching using Lua scripts to prevent premature lock releases.

---

## 4. Class: RedisStreamsAdapter

Handles low-level stream buffering and consumer read groups.

```typescript
class RedisStreamsAdapter {
  constructor(client: RedisClient);
  public async appendToStream(
    streamKey: string,
    fields: Record<string, string>
  ): Promise<string>;
  public async readGroup(
    streamKey: string,
    groupName: string,
    consumerName: string,
    options: ConsumerGroupReadOptions
  ): Promise<StreamEntry[]>;
  public async acknowledge(
    streamKey: string,
    groupName: string,
    entryId: string
  ): Promise<void>;
}
```

---

## 5. Serializers

Converts domain entities to binary/string hash structures:

- `TenantSerializer`
- `DriverSerializer`
- `SessionSerializer`
- `TelemetrySerializer`
- `EventStreamSerializer`
