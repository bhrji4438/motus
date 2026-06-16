# Getting Started with Motus

This guide provides a step-by-step tutorial on integrating the Motus engine into your platform, covering installation, SDK initialization, tenant registration, driver presence management, and dispatch session lifecycles.

---

## 1. Installation

To use the Motus core SDK, add it to your project along with the peer dependencies (e.g. `ioredis`):

```bash
npm install @motus/core @motus/redis ioredis
```

---

## 2. Initialize the Motus Client

The main entrance to the SDK is the `Motus` facade client. Initialize it by setting up the underlying Redis connection managers, repositories, and managers.

```typescript
import Redis from "ioredis";
import { Motus, ConfigurationManager } from "@motus/core";
import {
  RedisClientManager,
  RedisTenantRepository,
  RedisDriverRepository,
  RedisSessionRepository,
  RedisPresenceRepository,
} from "@motus/redis";

// 1. Initialize Redis connection
const redisClient = new Redis({
  host: "127.0.0.1",
  port: 6379,
});

// 2. Initialize Motus Redis Repositories
const clientManager = new RedisClientManager(redisClient);
const tenantRepository = new RedisTenantRepository(clientManager);
const driverRepository = new RedisDriverRepository(clientManager);
const sessionRepository = new RedisSessionRepository(clientManager);
const presenceRepository = new RedisPresenceRepository(clientManager);

// 3. Initialize Motus client namespace handlers
const motusClient = new Motus(
  tenantRepository,
  driverRepository,
  sessionRepository,
  new SystemClock()
);
```

---

## 3. Register a Tenant

Every driver, session, and configuration in Motus resides within a Tenant boundary. Register your tenant:

```typescript
const tenantResult = await motusClient.tenant.registerTenant({
  name: "Global Logistics Inc",
  matchingConfig: {
    strategy: "HAVERSINE",
    maxCandidatesPerWave: 5,
  },
  retryPolicy: {
    waveTimeoutSeconds: 8,
  },
  zones: [
    {
      name: "Downtown Zone",
      boundary: [
        { latitude: 40.7128, longitude: -74.006 },
        { latitude: 40.72, longitude: -74.006 },
        { latitude: 40.72, longitude: -73.99 },
        { latitude: 40.7128, longitude: -73.99 },
      ],
    },
  ],
});

console.log("Registered Tenant:", tenantResult.tenantId);
```

---

## 4. Onboard and Manage Drivers

Before a driver can accept trip offers, register them and mark their presence status as `ONLINE`:

```typescript
const tenantId = tenantResult.tenantId;

// 1. Register the driver
const driverResult = await motusClient.driver.registerDriver({
  tenantId,
  capacity: 1,
  vehicleType: "SEDAN",
});

const driverId = driverResult.id;

// 2. Transition driver to ONLINE status
await motusClient.driver.setDriverOnline(tenantId, driverId);

// 3. Update driver location coordinate (enables spatial matching)
await motusClient.driver.updateDriverLocation({
  tenantId,
  driverId,
  location: {
    latitude: 40.7135,
    longitude: -74.001,
    accuracy: 5,
    bearing: 90,
    speed: 12,
  },
});
```

---

## 5. Create a Dispatch & Tracking Session

When a customer books a ride, create a session to search, rank, and progressive-wave offer the ride to candidates:

```typescript
// 1. Initialize session
const sessionResult = await motusClient.session.createSession({
  tenantId,
  pickup: { latitude: 40.713, longitude: -74.002 },
  destination: { latitude: 40.7306, longitude: -73.9352 },
  constraints: {
    requiredVehicleType: "SEDAN",
  },
});

const sessionId = sessionResult.id;

// 2. Start the dispatch matching loop
// Motus will query ONLINE drivers within the tenant's geo index and push notifications.
console.log("Session matching started. Session ID:", sessionId);
```

---

## 6. Subscribe to Realtime Updates

Clients (such as passenger apps) can subscribe to session channels to receive live driver coordinate updates:

```typescript
import { io } from "socket.io-client";

const socket = io("https://api.motus-platform.org/sessions");

// Join the tracking room for the active session
socket.emit("join_room", { tenantId, sessionId });

// Listen for live location updates
socket.on("tracking_broadcast", (locationUpdate) => {
  console.log(
    "Live driver coordinate:",
    locationUpdate.latitude,
    locationUpdate.longitude
  );
});
```
