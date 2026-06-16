# API Reference - @motus/types

This document details the shared contracts, schemas, domain enums, command payloads, and result interfaces of the `@motus/types` package.

---

## 1. Domain Enums

Standard state indicators used across packages:

### `PresenceStatus`

- `ONLINE` — Available for wave offerings.
- `BUSY` — Driver has reached maximum load capacity.
- `PAUSED` — Temporarily excluded from matching.
- `STALE` — Heartbeat failed (grace reconnection period).
- `OFFLINE` — Shift concluded.

### `SessionState`

- `CREATED` — Initialized state.
- `SEARCHING` — Actively ranking and progressive offering to candidates.
- `DRIVER_ASSIGNED` — Offer accepted.
- `DRIVER_EN_ROUTE` — Driver moving to pickup.
- `ARRIVED` — Driver at pickup.
- `IN_PROGRESS` — Passenger onboard.
- `COMPLETED` — Session concluded.
- `CANCELLED` — Session terminated.
- `DRIVER_LOST` — Active driver dropped socket connection.

---

## 2. Command Types

Standard arguments submitted to SDK namespaces:

### `RegisterTenantCommand`

```typescript
interface RegisterTenantCommand {
  name: string;
  matchingConfig: {
    strategy: "HAVERSINE" | "OSRM";
    maxCandidatesPerWave: number;
  };
  retryPolicy: {
    waveTimeoutSeconds: number;
  };
  zones?: {
    name: string;
    boundary: { latitude: number; longitude: number }[];
  }[];
}
```

### `RegisterDriverCommand`

```typescript
interface RegisterDriverCommand {
  tenantId: string;
  capacity: number;
  vehicleType: string;
}
```

### `CreateSessionCommand`

```typescript
interface CreateSessionCommand {
  tenantId: string;
  pickup: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number };
  constraints?: {
    requiredVehicleType?: string;
  };
}
```

---

## 3. Results Schemas

Returns objects delivered by namespace promises:

### `DriverResult`

```typescript
interface DriverResult {
  id: string;
  tenantId: string;
  status: PresenceStatus;
  capacity: number;
  currentLoad: number;
  vehicleType: string;
  lastHeartbeat: number;
  lastLocation?: {
    latitude: number;
    longitude: number;
  };
}
```

### `SessionResult`

```typescript
interface SessionResult {
  id: string;
  tenantId: string;
  status: SessionState;
  pickup: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number };
  assignedDriverId?: string;
  createdAt: string;
  updatedAt: string;
}
```
