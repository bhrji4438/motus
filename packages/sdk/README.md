# vectro

The official, public developer SDK for **Vectro** — the open-source real-time dispatch, tracking, fleet management, and mobility platform toolkit.

This package provides an ergonomic, developer-friendly facade that consolidates the underlying monorepo packages (`@motus/core`, `@motus/redis`, `@motus/socketio`, `@motus/types`, and `@motus/observability`) into a single entry point.

---

## 1. Installation

Install the Vectro SDK and its required peer dependency `ioredis`:

```bash
npm install vectro ioredis
```

---

## 2. Quick Start

Initialize Vectro in a single step using `createVectro`:

```typescript
import { createVectro, MatchingStrategy } from "vectro";

async function main() {
  // Initialize Vectro client (boots database connections and Socket.IO server)
  const vectro = await createVectro({
    redis: {
      host: "localhost",
      port: 6379,
    },
    socketio: {
      port: 3000,
    }
  });

  const tenantId = "tnt_downtown_taxi";

  // 1. Register a Tenant Workspace
  await vectro.tenant.registerTenant({
    tenantId,
    name: "Downtown Taxi Co",
    matchingStrategy: MatchingStrategy.DISTANCE,
    geofences: []
  });

  // 2. Onboard a Driver
  await vectro.driver.registerDriver({
    tenantId,
    driverId: "drv_active_001",
    capacity: 4,
    vehicleType: "SEDAN"
  });

  // 3. Set Driver Status Online to Allow Matching
  await vectro.driver.setDriverOnline(tenantId, "drv_active_001");

  // 4. Update Driver Location (Ingests GPS coordinates)
  await vectro.driver.updateDriverLocation({
    tenantId,
    driverId: "drv_active_001",
    latitude: 40.7128,
    longitude: -74.0060,
    timestamp: new Date().toISOString()
  });

  // 5. Create a Dispatch and Tracking Session
  await vectro.session.createSession({
    tenantId,
    sessionId: "ses_trip_789",
    pickup: { latitude: 40.7130, longitude: -74.0050 },
    destination: { latitude: 40.7306, longitude: -73.9352 },
    requiredVehicleType: "SEDAN"
  });

  // 6. Listen to Realtime Events
  vectro.events.on("session.assigned", (event) => {
    console.log(`Trip ${event.payload.sessionId} assigned to Driver ${event.payload.assignedDriverId}`);
  });

  // ... run application ...

  // Graceful Shutdown
  await vectro.stop();
}

main().catch(console.error);
```

---

## 3. Configuration Options

Pass a `VectroConfig` object to `createVectro()` to control the setup of the Redis client manager, background intervals, and Socket.IO gateway.

```typescript
export interface VectroConfig {
  redis?: {
    host?: string;      // Defaults to process.env.REDIS_HOST or 'localhost'
    port?: number;      // Defaults to process.env.REDIS_PORT or 6379
    password?: string;  // Defaults to process.env.REDIS_PASSWORD
    db?: number;        // Defaults to process.env.REDIS_DB or 0
    mode?: "standalone" | "sentinel" | "cluster"; // Connection mode
    keyPrefix?: string; // Redis key prefix. Defaults to 'vectro'. (Use 'motus' for legacy upgrade compatibility)
  };
  socketio?: {
    port?: number;      // Port to start Socket.IO server on
    path?: string;      // Socket.IO gateway path. Defaults to '/socket.io'
    authenticator?: IAuthenticator; // Custom handshake authenticator
    connectionStateRecovery?: {
      enabled: boolean;
      maxConnectionDelayMs?: number;
    };
  };
}
```

### Zero-Downtime Migration / Rolling Upgrades
If you are upgrading an existing production deployment that uses legacy `motus:` keys prefix, set the `redis.keyPrefix` parameter to `"motus"` to avoid data loss.

---

## 4. SDK Namespaces

Once initialized, the `VectroInstance` exposes 5 distinct API namespaces:

### 📡 `vectro.tenant`
Manage tenant environments and workspaces.
- `registerTenant(command)`: Onboard a new tenant workspace configuration.
- `updateTenant(command)`: Modify matching strategies and geofences.

### 🚗 `vectro.driver`
Coordinate driver shifts, status states, and location tracking.
- `registerDriver(command)`: Register new driver capacity and vehicle types.
- `setDriverOnline(tenantId, driverId)` / `setDriverOffline(tenantId, driverId)`: Control shift availability.
- `updateDriverLocation(command)`: Push GPS heartbeat coordinates.
- `acceptSessionOffer(tenantId, driverId, sessionId, waveNumber)`: Accept trip offer during a active wave.

### ⏱️ `vectro.session`
Track lifecycle dispatch sessions.
- `createSession(command)`: Start matching engine for passenger/cargo trip request.
- `cancelSession(command)`: Stop active search or trip.
- `completeSession(command)`: Conclude trip and archive coordinates.

### 🔍 `vectro.query`
Query real-time coordinates, active sessions, and driver status.

### 🔔 `vectro.events`
Subscribe to live system-wide events and state transitions.
- `on(eventName, listener)`: Listen to specific events (e.g. `session.created`, `session.assigned`, `driver.stale`, etc.).

---

## 5. Graceful Shutdown

To prevent leaking resources (database connections, background setInterval tasks, active Socket.IO listener handles), invoke the `stop()` method:

```typescript
await vectro.stop();
```
