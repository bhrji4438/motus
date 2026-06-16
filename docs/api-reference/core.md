# API Reference - SDK Core

This document details the public signatures, namespaces, methods, and configurations of the Vectro SDK core package.

---

## 1. Class: Motus (Vectro Instance Facade)

The central facade client coordinating namespaces and state managers.

### Public Properties

- `tenant`: [TenantNamespace](core.md#2-class-tenantnamespace)
- `driver`: [DriverNamespace](core.md#3-class-drivernamespace)
- `session`: [SessionNamespace](core.md#4-class-sessionnamespace)
- `query`: [QueryNamespace](core.md#5-class-querynamespace)
- `events`: [EventNamespace](core.md#6-class-eventnamespace)

---

## 2. Class: TenantNamespace

### Methods

#### `registerTenant(command: RegisterTenantCommand): Promise<TenantResult>`

Registers a tenant with configurations.

- **Parameters**: `command` (TenantName, matching strategy, waveTimeout, maximum capacity, geofences)
- **Returns**: `TenantResult` containing generated IDs.

#### `updateTenant(command: UpdateTenantCommand): Promise<TenantResult>`

Modifies tenant policies.

#### `getTenant(tenantId: TenantId): Promise<TenantResult>`

Fetches tenant profiles.

---

## 3. Class: DriverNamespace

### Methods

#### `registerDriver(command: RegisterDriverCommand): Promise<DriverResult>`

Onboards driver with load capacities.

#### `updateDriver(command: UpdateDriverCommand): Promise<DriverResult>`

Modifies capabilities.

#### `getDriver(tenantId: TenantId, driverId: DriverId): Promise<DriverResult>`

Fetches presence profiles.

#### `setDriverOnline(tenantId: TenantId, driverId: DriverId): Promise<void>`

Sets status to ONLINE.

#### `setDriverOffline(tenantId: TenantId, driverId: DriverId): Promise<void>`

Sets status to OFFLINE.

#### `setDriverPaused(tenantId: TenantId, driverId: DriverId): Promise<void>`

Sets status to PAUSED.

#### `updateDriverLocation(command: UpdateDriverLocationCommand): Promise<void>`

Ingests GPS locations.

#### `acceptSessionOffer(tenantId: TenantId, driverId: DriverId, sessionId: SessionId, waveNumber: number): Promise<void>`

Submits wave offer acceptances.

#### `rejectSessionOffer(tenantId: TenantId, driverId: DriverId, sessionId: SessionId, waveNumber: number): Promise<void>`

Submits wave offer rejections.

---

## 4. Class: SessionNamespace

### Methods

#### `createSession(command: CreateSessionCommand): Promise<SessionResult>`

Spawns session tracking.

#### `cancelSession(command: CancelSessionCommand): Promise<SessionResult>`

Cancels matching or transit.

#### `completeSession(command: CompleteSessionCommand): Promise<SessionResult>`

Concludes transit.

#### `reassignSession(command: ReassignSessionCommand): Promise<SessionResult>`

Forces candidate reselection.

---

## 5. Class: QueryNamespace

### Methods

#### `getSession(tenantId: TenantId, sessionId: SessionId): Promise<SessionResult>`

Retrieves session metadata.

#### `getSessionEvents(tenantId: TenantId, sessionId: SessionId): Promise<readonly EventResult[]>`

Gets timeline log audits.

#### `getSessionReport(tenantId: TenantId, sessionId: SessionId): Promise<SessionReportResult>`

Compiles path history reports.

---

## 6. Class: EventNamespace

### Methods

#### `on(eventPattern, handler): void`

Subscribes to events.

#### `off(eventPattern, handler): void`

Unsubscribes from events.

#### `once(eventPattern, handler): void`

Subscribes to events for a single execution.

---

## 7. Common Errors & Validation Codes

The module exports maps to translate error states to HTTP/WS protocols:

```typescript
import {
  HTTP_CODE_MAP,
  WEBSOCKET_CODE_MAP,
  isErrorCodeRetryable,
} from "vectro";

// Example: Map domain errors to HTTP statuses
const statusCode = HTTP_CODE_MAP[error.code] || 500;

// Example: Check if error is temporary (retryable)
const retry = isErrorCodeRetryable(error.code);
```

- `CONCURRENCY_LOCK_FAILED` (409 Conflict): Lock acquisition collision.
- `TENANT_NOT_FOUND` (404 Not Found): Unregistered tenant references.
- `INVALID_COORDINATE` (400 Bad Request): Lat/lng out of bounds.
