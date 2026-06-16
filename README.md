# Vectro: Open-Source Real-Time Dispatch & Tracking Engine

Vectro is an open-source real-time dispatch, tracking, fleet management, and mobility platform toolkit.

It is a high-throughput, low-latency, multi-tenant engine designed to manage driver presence, location tracking, progressive wave-based dispatching, ride lifecycles, and real-time telemetry. Vectro allows developers to build mobility, logistics, emergency dispatch, and field service platforms without reinventing spatial-temporal state management and assignment pipelines.

> [!NOTE]
> **Repository Transition**: The project is currently transitioning from **Motus** to **Vectro**. The internal workspaces utilize the `@motus/` namespace dependencies to ensure stable local package links, but all developer-facing APIs, public packages, and integrations are fully rebranded to **Vectro**.

---

## 🚀 Business Value & Problem Solved

Traditional transactional databases are ill-suited for real-time spatial calculations, fast heartbeat presence tracking, and high-frequency GPS ingestion. Creating custom solutions often leads to split-brain assignments, driver double-bookings, race conditions, stale locations, and poor scalability.

**Vectro solves this by:**
1. **Managing Driver Presence & Location State:** High-performance in-memory (Redis-backed) presence tracking that keeps track of online, busy, paused, stale, and offline drivers.
2. **Spatial-Temporal Querying:** Discovering nearby, eligible candidates using spatial indexes.
3. **Atomic Progressive Wave Dispatch:** Sending offers to drivers in sequential, atomic waves, ensuring a driver can only have one active lock at any given time to eliminate double-bookings.
4. **Resilient Session Lifecycles:** A strict state-machine that handles drops in connectivity, driver recovery, client handshakes, and route telemetry archival.
5. **Real-time Synchronization:** Instantly distributing live coordinate streams to clients subscribing to active trip session rooms.

---

## 🗺️ What Can I Build?

| Use Case | Required Modules |
| :--- | :--- |
| **Ride Hailing** | Tracking + Dispatch + Realtime + Ride Lifecycle |
| **Delivery Platform** | Tracking + Dispatch + Notifications |
| **Fleet Management** | Tracking + Driver Management |
| **Asset Tracking** | Tracking |
| **Emergency Dispatch** | Dispatch + Geofencing + Realtime |

---

## 📦 Installation

To get started, install the all-in-one public developer SDK:

```bash
npm install vectro
```

---

## ⚡ 5-Minute Quick Start

Implement a complete happy-path dispatch and tracking workflow in minutes:

```typescript
import { createVectro, MatchingStrategy } from "vectro";

async function run() {
  // 1. Initialize Vectro (Connects to Redis & boots Socket.IO server on port 3000)
  const vectro = await createVectro({
    redis: { host: "localhost", port: 6379 },
    socketio: { port: 3000 }
  });

  const tenantId = "tnt_quickstart";
  const driverId = "drv_john_doe";
  const sessionId = "ses_ride_123";

  // 2. Listen to Event Namespace Stream
  vectro.events.on("session.created", (event) => {
    console.log(`[Event] Session created: ${event.payload.sessionId}`);
  });

  vectro.events.on("session.assigned", (event) => {
    console.log(`[Event] Session assigned to Driver: ${event.payload.assignedDriverId}`);
  });

  // 3. Register a Tenant Workspace
  await vectro.tenant.registerTenant({
    tenantId,
    name: "Downtown Logistics",
    matchingStrategy: MatchingStrategy.DISTANCE,
    geofences: [
      {
        name: "Downtown Zone",
        boundary: [
          { latitude: 40.7128, longitude: -74.0060 },
          { latitude: 40.7200, longitude: -74.0060 },
          { latitude: 40.7200, longitude: -73.9900 },
          { latitude: 40.7128, longitude: -73.9900 }
        ]
      }
    ]
  });

  // 4. Onboard and Activate a Driver
  await vectro.driver.registerDriver({
    tenantId,
    driverId,
    capacity: 1,
    vehicleType: "SEDAN"
  });

  // Set driver online (allows matching)
  await vectro.driver.setDriverOnline(tenantId, driverId);

  // 5. Update Driver Location (GPS coordinates inside the Downtown geofence)
  await vectro.driver.updateDriverLocation({
    tenantId,
    driverId,
    latitude: 40.7135,
    longitude: -74.0010,
    timestamp: new Date().toISOString()
  });

  // 6. Create a Dispatch and Tracking Session (starts matching engine)
  await vectro.session.createSession({
    tenantId,
    sessionId,
    pickup: { latitude: 40.7130, longitude: -74.0020 },
    destination: { latitude: 40.7306, longitude: -73.9352 },
    requiredVehicleType: "SEDAN"
  });

  // Wait 2 seconds for wave calculations
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // 7. Driver accepts the offer
  await vectro.driver.acceptSessionOffer(tenantId, driverId, sessionId, 1);

  // 8. Conclude session after en-route updates
  await vectro.session.completeSession({ tenantId, sessionId });

  // Graceful shutdown
  await vectro.stop();
}

run().catch(console.error);
```

---

## 🛠️ Core Business Modules

The engine consists of the following modular business blocks:

| Module | Purpose | Documentation |
| :--- | :--- | :--- |
| **Tracking** | GPS coordinates ingestion, polyline compression, and route history. | [docs/modules/tracking.md](docs/modules/tracking.md) |
| **Dispatching** | Wave offers, candidate filtering, atomic locks, and dispatch strategies. | [docs/modules/dispatching.md](docs/modules/dispatching.md) |
| **Driver Management** | Onboarding profiles, connection heartbeats, shift durations, and statuses. | [docs/modules/driver-management.md](docs/modules/driver-management.md) |
| **Ride Lifecycle** | Strict session state machine (Created, Searching, Assigned, Arrived, Complete). | [docs/modules/ride-lifecycle.md](docs/modules/ride-lifecycle.md) |
| **Realtime Communication** | Sticky WebSocket scaling, session rooms, and location broadcasts. | [docs/modules/realtime-communication.md](docs/modules/realtime-communication.md) |
| **Notifications** | Offer push alerts targeting (FCM / APNs / OneSignal integration). | [docs/modules/notifications.md](docs/modules/notifications.md) |
| **Geofencing** | Polygon boundary calculations and automatic intersection entry/exit audit. | [docs/modules/geofencing.md](docs/modules/geofencing.md) |
| **Audit Logging** | Role-Based Access Control (RBAC) event audit compliance trails. | [docs/modules/audit-logging.md](docs/modules/audit-logging.md) |
| **Queue Processing** | Asynchronous background workers and stream consumer group execution. | [docs/modules/queue-processing.md](docs/modules/queue-processing.md) |
| **Observability** | OpenTelemetry tracers, health metrics registry, and correlation IDs. | [docs/modules/observability.md](docs/modules/observability.md) |

---

## 📚 Business Module → SDK Namespace Mapping

Vectro groups APIs into cohesive operational namespaces inside the SDK:

| Business Module | SDK Namespace | Primary APIs |
| :--- | :--- | :--- |
| **Tracking** | `vectro.driver` + `vectro.query` | `updateDriverLocation()`, `getSessionReport()` |
| **Dispatching** | `vectro.session` + `vectro.events` | `createSession()`, `acceptSessionOffer()`, `on("dispatch.wave.started")` |
| **Driver Management**| `vectro.driver` | `registerDriver()`, `setDriverOnline()`, `setDriverOffline()` |
| **Geofencing** | `vectro.tenant` | `registerTenant()`, Configured in `geofences` boundary arrays |
| **Notifications** | External `NotificationService` | Integrated with FCM, APNs, and OneSignal triggers |
| **Realtime** | `vectro.events` + Socket.IO | `on()`, Namespace room joins via `/sessions` and `/drivers` |
| **Audit Logging** | `vectro.events` | Wildcard subscriptions (`on("*")`) mapping event stream outbox |
| **Queue Processing** | Configuration parameters | Autostarts background interval loops when booting engine |
| **Observability** | External `Tracer` / `logger` | `Tracer.initialize()`, `CorrelationContext.run()` |

---

## 📖 Common Implementation Recipes

Direct documentation paths for common integration patterns:

| I Want To | Documentation |
| :--- | :--- |
| **Register Drivers** | [Driver Management Module](docs/modules/driver-management.md) |
| **Track Drivers** | [Tracking Module](docs/modules/tracking.md) |
| **Create Sessions** | [Dispatching Module](docs/modules/dispatching.md) |
| **Listen For Events** | [Realtime Communication Hub](docs/modules/realtime-communication.md) |
| **Send Notifications** | [Notification Dispatcher Module](docs/modules/notifications.md) |
| **Configure Geofences** | [Geofencing Module](docs/modules/geofencing.md) |
| **Scale Workers** | [Production Deployment Guide](docs/deployment.md) |

---

## 🗺️ Product Workflow Flow

Below is the high-level operational lifecycle of a ride session:

```mermaid
sequenceDiagram
    autonumber
    actor Driver
    participant App as Consuming Backend
    participant Vectro as Vectro Engine
    actor Customer

    Driver->>Vectro: Send Heartbeat & Location Update (WebSocket)
    Note over Vectro: Driver status updated to ONLINE & spatial index updated

    Customer->>App: Book a Ride
    App->>Vectro: Create Session (sessionId, pickup, destination, constraints)
    Vectro-->>App: Event: session.created

    Vectro->>Vectro: Execute Matching Engine & start Wave 1 Offers
    Vectro-->>App: Event: dispatch.wave.started (notified candidates)
    App->>Driver: Push notification: New Trip Offer

    Driver->>Vectro: Accept Offer (driverId, sessionId, waveNumber)
    Note over Vectro: Atomic Lock validated; status transitions to BUSY
    Vectro-->>App: Event: session.assigned

    Driver->>Vectro: Stream GPS coordinates during transit (DRIVER_EN_ROUTE)
    Vectro-->>Customer: Broadcast live locations in session room (Realtime)

    Driver->>Vectro: Arrived at pickup (ARRIVED) -> Start trip (IN_PROGRESS) -> Complete trip (COMPLETED)
    Vectro-->>App: Event: session.completed
    Vectro->>Vectro: Archive Telemetry & prune transient session data
```

---

## 🏗️ Architectural Topology

Vectro acts as a low-latency caching and processing engine sitting alongside your persistent system of record (RDBMS / Document DB).

```mermaid
flowchart TD
    subgraph Client [Client Apps]
        DApp[Driver App]
        CApp[Customer App]
    end

    subgraph LB [Load Balancer]
        Ingress[Nginx/HAProxy]
    end

    subgraph Vectro [Vectro Engine]
        SocketIO[@motus/socketio]
        Core[@motus/core]
        Redis[@motus/redis]
        Obs[@motus/observability]
    end

    subgraph Cache [State Layer]
        RCluster[(Redis Cluster)]
    end

    subgraph External [External Services]
        FCM[Firebase/APNs]
        OSRM[Routing/ETA API]
    end

    DApp -->|WebSocket| Ingress
    CApp -->|WebSocket| Ingress
    Ingress --> SocketIO
    SocketIO --> Core
    Core --> Redis
    Redis --> RCluster
    Core --> FCM
    Core --> OSRM
    Obs --> Core
```

---

## 📂 Packages Overview

This monorepo partitions features into clean TypeScript packages:

- **[@motus/types](packages/types)**: Domain definitions, event contracts, versioning constraints, and configuration schemas.
- **[@motus/core](packages/core)**: Bounded context managers, state machines, math utilities, and worker loops.
- **[@motus/redis](packages/redis)**: Serialization, keys management, repositories, Redlock lockers, and stream adapters.
- **[@motus/socketio](packages/socketio)**: WebSocket gateway server, room management, and handshake structures.
- **[@motus/notifications](packages/notifications)**: Push targeting, template rendering, APNs/FCM providers, and scheduling.
- **[@motus/observability](packages/observability)**: Tracer registry, logger, correlation context, and metric exporters.
- **[@motus/testing](packages/testing)**: In-memory repository mocks, test containers, and socket connection builders.
- **[@motus/dashboard](packages/dashboard)**: Fastify REST endpoints, SSE streams, and React-based real-time analytics UI.
- **[vectro](packages/sdk)**: The public facade SDK. Consolidates all core and real-time transport packages into a single installation, offering an ergonomic `createVectro()` bootstrapper.

---

## ⚡ Quick Start (Developer Setup)

### 1. Prerequisites
- Node.js (v18+)
- Docker (required for integration tests running Redis cluster locally)

### 2. Install Dependencies
```bash
npm install
```

### 3. Build the Packages
```bash
npm run build
```

### 4. Running the Tests
```bash
# Run unit tests
npm run test

# Run type checking
npm run typecheck
```

---

## 🗂️ Documentation Navigation Hub

Explore the detailed documentation pages below:

| I Want To... | Go Here |
| :--- | :--- |
| **Get Started** | [docs/getting-started.md](docs/getting-started.md) |
| **Understand Platform Flow** | [PRODUCT_FLOW.md](PRODUCT_FLOW.md) |
| **View Architecture details** | [ARCHITECTURE.md](ARCHITECTURE.md) |
| **Implement Driver Shifts** | [Driver Management Module](docs/modules/driver-management.md) |
| **Implement Tracking** | [Tracking Module](docs/modules/tracking.md) |
| **Implement Dispatching** | [Dispatching Module](docs/modules/dispatching.md) |
| **Understand Geofences** | [Geofencing Module](docs/modules/geofencing.md) |
| **Deploy to Production** | [docs/deployment.md](docs/deployment.md) |
| **Test Integrations** | [docs/testing.md](docs/testing.md) |
| **Troubleshoot Deployments** | [docs/troubleshooting.md](docs/troubleshooting.md) |
| **Customize or Extend Vectro** | [Extension Customization Guide](docs/extending/customization-guide.md) |
| **View API Reference Index** | [API Reference Index](docs/api-reference/core.md) |
| **Submit Contributions** | [CONTRIBUTING.md](CONTRIBUTING.md) |
| **Migrate from Motus to Vectro** | [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) |
