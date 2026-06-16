# API Reference - @motus/redis

This document details the classes, interfaces, and repositories of the `@motus/redis` package.

---

## 1. Class: RedisClientManager

Manages standard connection, cluster, and Sentinel connections.

```typescript
export class RedisClientManager {
  constructor(client: ioredis.Redis | ioredis.Cluster);
  public getClient(): ioredis.Redis | ioredis.Cluster;
}
```

---

## 2. Repositories

All repositories consume `RedisClientManager` and enforce multi-tenant separation.

### A. RedisTenantRepository

```typescript
class RedisTenantRepository {
  public async saveTenant(tenant: Tenant): Promise<void>;
  public async getTenant(tenantId: TenantId): Promise<Tenant | null>;
}
```

### B. RedisDriverRepository

```typescript
class RedisDriverRepository {
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
  public async saveSession(session: Session): Promise<void>;
  public async getSession(
    tenantId: TenantId,
    sessionId: SessionId
  ): Promise<Session | null>;
}
```

### D. RedisGeoRepository

```typescript
class RedisGeoRepository {
  public async updateLocation(
    tenantId: TenantId,
    driverId: DriverId,
    coord: Coordinate
  ): Promise<void>;
  public async searchNearby(
    tenantId: TenantId,
    coord: Coordinate,
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

Implements Redlock algorithms.

```typescript
class RedisLockManager {
  public async acquireLock(
    tenantId: TenantId,
    resource: string,
    token: string,
    ttlMs: number
  ): Promise<LockHandle | null>;
  public async releaseLock(
    tenantId: TenantId,
    resource: string,
    token: string
  ): Promise<boolean>;
}
```

- **Safety**: Validates token value matching using Lua scripts to prevent premature lock releases.

---

## 4. Class: RedisStreamsAdapter

Handles low-level stream buffering and consumer read groups.

```typescript
class RedisStreamsAdapter {
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

Converts domain entities to binary/string hash structures and handles schema migrations:

- `TenantSerializer`
- `DriverSerializer`
- `SessionSerializer`
- `TelemetrySerializer`
- `EventStreamSerializer`
