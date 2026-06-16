# Getting Started with Vectro

This guide provides a step-by-step tutorial on integrating the Vectro engine into your platform, covering installation, SDK initialization, tenant registration, driver presence management, and dispatch session lifecycles.

---

## 1. Installation

To get started with Vectro, add the public SDK package to your project:

```bash
npm install vectro
```

---

## 2. Initialize the Vectro Client

The main entrance to Vectro is the client instance returned by `createVectro`. It boots up the underlying connection pools, dynamic Redis namespaces, event bus, and Socket.IO server endpoints.

```typescript
import { createVectro } from "vectro";

// Initialize Vectro platform
const vectro = await createVectro({
  redis: {
    host: "127.0.0.1",
    port: 6379,
    keyPrefix: "vectro" // Default prefix (use 'motus' for legacy compatibility)
  },
  socketio: {
    port: 3000 // Starts a Socket.IO WebSocket gateway server on port 3000
  }
});
```

---

## 3. Register a Tenant

Every driver, session, and configuration in Vectro resides within a Tenant boundary. Register your tenant:

```typescript
import { MatchingStrategy } from "vectro";

const tenantResult = await vectro.tenant.registerTenant({
  tenantId: "tnt_global_logistics",
  name: "Global Logistics Inc",
  matchingStrategy: MatchingStrategy.DISTANCE,
  geofences: [
    {
      name: "Downtown Zone",
      boundary: [
        { latitude: 40.7128, longitude: -74.0060 },
        { latitude: 40.7200, longitude: -74.0060 },
        { latitude: 40.7200, longitude: -73.9900 },
        { latitude: 40.7128, longitude: -73.9900 },
      ],
    },
  ],
  idempotencyKey: "tnt_reg_key_101"
});

console.log("Registered Tenant Workspace:", tenantResult.tenantId);
```

---

## 4. Onboard and Manage Drivers

Before a driver can accept trip offers, register them and transition their status to `ONLINE`:

```typescript
const tenantId = "tnt_global_logistics";
const driverId = "driver-courier-john";

// 1. Register driver capabilities
await vectro.driver.registerDriver({
  tenantId,
  driverId,
  capacity: 1, // Max concurrent sessions the driver can handle
  vehicleType: "SEDAN",
  idempotencyKey: "drv_reg_key_101"
});

// 2. Transition driver to ONLINE (makes driver eligible for wave matching)
await vectro.driver.setDriverOnline(tenantId, driverId);

// 3. Update driver location coordinate (enables spatial indexing)
await vectro.driver.updateDriverLocation({
  tenantId,
  driverId,
  latitude: 40.7135,
  longitude: -74.0010,
  timestamp: new Date().toISOString()
});
```

---

## 5. Create a Dispatch & Tracking Session

When a customer books a ride, create a session to search, rank, and offer the ride to candidates in progressive waves:

```typescript
// 1. Initialize session
const sessionResult = await vectro.session.createSession({
  tenantId,
  sessionId: "session-ride-88",
  pickup: { latitude: 40.7130, longitude: -74.0020 },
  destination: { latitude: 40.7306, longitude: -73.9352 },
  requiredVehicleType: "SEDAN",
  idempotencyKey: "ses_reg_key_101"
});

// 2. Start the dispatch matching loop
// Vectro will query ONLINE drivers within the tenant's geo index and push notifications.
console.log("Session matching started. Session ID:", sessionResult.id);
```

---

## 6. Subscribe to Real-Time Updates

### Back-End Event Stream
Listen to domain events directly in your node.js service:

```typescript
vectro.events.on("dispatch.wave.started", (event) => {
  const { sessionId, candidates, waveNumber } = event.payload as any;
  console.log(`Wave #${waveNumber} started for session ${sessionId}. Candidates: ${candidates.join(",")}`);
});

vectro.events.on("session.assigned", (event) => {
  console.log(`Session ${event.payload.sessionId} assigned to driver ${event.payload.assignedDriverId}`);
});
```

### Client Room Connection (WebSockets)
Clients (such as passenger apps) can subscribe to session channels to receive live driver coordinate updates:

```typescript
import { io } from "socket.io-client";

const socket = io("https://api.vectro-platform.org/sessions");

// Join the tracking room for the active session
socket.emit("join_room", { tenantId, sessionId: "session-ride-88" });

// Listen for live location updates
socket.on("tracking_broadcast", (locationUpdate) => {
  console.log(
    "Live driver coordinate:",
    locationUpdate.latitude,
    locationUpdate.longitude
  );
});
```

---

## 7. Graceful Shutdown

To close connection pools and terminate background worker intervals:

```typescript
await vectro.stop();
```
