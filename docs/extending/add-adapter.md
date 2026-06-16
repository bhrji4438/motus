# How to Add a New Adapter

This guide describes how to write custom database repositories, cache adapters, or event buses conforming to core ports.

---

## 1. Overview of Ports

The `@motus/core` package defines ports (interfaces) that decouple core business machines from specific database engines:

- `IDriverRepository` — Ingests and retrieves driver entities.
- `ISessionRepository` — Manages state machines and active sessions.
- `ILockManager` — Manages candidate exclusion locks.
- `IEventBus` — Dispatches domain state mutations.

To swap Redis out for an alternative backend (e.g. Memcached, DynamoDB, or Kafka), implement the target port interface in an adapter package.

---

## 2. Implementing a Port (e.g., DynamoDB Driver Repository)

### Step A: Implement Interface

Create an implementation conforming to `IDriverRepository` from `@motus/core/ports`:

```typescript
import { IDriverRepository, Driver, DriverId, TenantId } from "@motus/core";

export class DynamoDbDriverRepository implements IDriverRepository {
  constructor(private readonly dynamoClient: any) {}

  public async saveDriver(driver: Driver): Promise<void> {
    await this.dynamoClient.put({
      TableName: "MotusDrivers",
      Item: driver,
    });
  }

  public async getDriver(
    tenantId: TenantId,
    driverId: DriverId
  ): Promise<Driver | null> {
    const res = await this.dynamoClient.get({
      TableName: "MotusDrivers",
      Key: { tenantId, id: driverId },
    });
    return (res.Item as Driver) || null;
  }
}
```

### Step B: Wire Up Dependencies

When initializing the `Motus` client namespace, pass your custom repository instance to the managers:

```typescript
import {
  Motus,
  DriverManager,
  TenantManager,
  SessionManager,
} from "@motus/core";
import { DynamoDbDriverRepository } from "./DynamoDbDriverRepository.js";

const dynamoDriverRepo = new DynamoDbDriverRepository(dynamoClient);

// Instantiate core managers with the custom repository
const driverManager = new DriverManager(dynamoDriverRepo);

const motusClient = new Motus(
  tenantManager,
  driverManager,
  sessionManager,
  new SystemClock()
);
```

All driver presence updates and query commands will now execute against DynamoDB!
