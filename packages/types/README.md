# `@motus/types`

The central source of truth for all domain models, value objects, type-safe API contracts, error codes, configuration schemas, event contracts, and extensibility interfaces of the **Motus** real-time dispatch and tracking engine.

This package is completely stateless, technology-neutral, and has zero production dependencies.

---

## Installation

Install the package via npm:

```bash
npm install @motus/types
```

---

## Package Usage Guide

### 1. Importing Domain Models and Value Objects

Import aggregates and value objects to guarantee type compliance in database adapters, state machines, or mapping scripts:

```typescript
import { Driver, Coordinates, DriverStatus } from '@motus/types';

const driverUpdate: Partial<Driver> = {
  status: DriverStatus.ONLINE,
  location: {
    latitude: 37.774929,
    longitude: -122.419416,
    timestamp: new Date().toISOString()
  }
};
```

### 2. Implementing Extensibility Adapters

Implement custom providers using the standard interfaces:

```typescript
import { MatchingProvider, Session, Driver, CandidateScore } from '@motus/types';

export class CustomScoreProvider implements MatchingProvider {
  public scoreCandidates(session: Session, candidates: readonly Driver[]): readonly CandidateScore[] {
    return candidates.map(driver => ({
      driverId: driver.id,
      score: driver.capacity - driver.currentLoad
    }));
  }
}
```

### 3. Typing Event Subscriptions

Leverage strongly-typed events to build reactive handlers:

```typescript
import { MotusEvent, SessionCreatedEvent } from '@motus/types';

function handleEvent(event: MotusEvent) {
  if (event.eventName === 'session.created') {
    const createdEvent = event as SessionCreatedEvent;
    console.log(`New session ${createdEvent.payload.sessionId} initialized.`);
  }
}
```

---

## Public API & Contract Reference

### 1. Namespaced SDK Commands & Results

Motus utilizes a transport-neutral Command-Query-Result pattern for all SDK endpoints, preventing protocol-specific framing biases (e.g. REST request/response locks):

#### Commands (Mutating Inputs)
- `RegisterTenantCommand`: Registers a workspace boundary.
- `RegisterDriverCommand`: Enters a driver profile into the tracker registry.
- `UpdateDriverLocationCommand`: Ingests raw real-time location.
- `CreateSessionCommand`: Triggers dispatcher searches.
- `CompleteSessionCommand`: Concludes a journey.
- `CancelSessionCommand`: Aborts a journey.
- `ReassignSessionCommand`: Recalls candidate searches.
- `AcceptSessionOfferCommand` / `RejectSessionOfferCommand`: Wave offer decision signals.

#### Results (Outputs)
- `TenantResult`: Tenant registry summary payload.
- `DriverResult`: Driver presence status and load details.
- `SessionResult`: Active coordinates and assigned statuses.
- `SessionReportResult`: Total duration, distance, path telemetry compile.

---

### 2. Domain Models & Statuses

#### Aggregates and Entities
- `Tenant`: Multi-tenant workspace configuration.
- `Driver`: Real-time driver presence aggregate.
- `Session`: Core dispatch order lifecycle coordinator.
- `SessionReport`: Historical fulfillment summary.
- `Location` / `TelemetryPoint`: Temporal coordinates.
- `Zone`: GeofencedClosed service polygons.
- `RetryPolicy` / `MatchingConfiguration` / `FanoutConfiguration`: Match policies.

#### Standard States and Enums
- `SessionState`: `CREATED`, `SEARCHING`, `DRIVER_ASSIGNED`, `DRIVER_EN_ROUTE`, `ARRIVED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `DRIVER_LOST`.
- `DriverStatus`: `OFFLINE`, `ONLINE`, `BUSY`, `PAUSED`, `STALE`.
- `ErrorCode`: `MOTUS_DRIVER_NOT_FOUND`, `MOTUS_SESSION_NOT_FOUND`, `MOTUS_INVALID_TRANSITION`, `MOTUS_DRIVER_BUSY`, `MOTUS_LOCK_ACQUISITION_FAILED`, etc.

---

### 3. Canonical Events Matrix

Every platform event implements `EventEnvelope` and is governed by strict delivery, partition, and sequence rules:

| Event Name | Producer | Consumers | Guarantee | Scope | Partition Key |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `tenant.created` | TenantService | Billing, Sockets | At Least Once | TENANT | `tenantId` |
| `driver.online` | PresenceEngine | Matching, Sockets | At Least Once | DRIVER | `driverId` |
| `driver.offline` | PresenceEngine | Dispatch, Sockets | At Least Once | DRIVER | `driverId` |
| `driver.paused` | PresenceEngine | MatchingEngine | At Least Once | DRIVER | `driverId` |
| `driver.location.updated` | LocationIngestion | Geofence, Sockets | At Most Once | DRIVER | `driverId` |
| `telemetry.sampled` | TelemetrySampler | SessionHistory | At Least Once | SESSION | `sessionId` |
| `session.created` | SessionService | Matching, Sockets | At Least Once | SESSION | `sessionId` |
| `session.searching` | DispatchEngine | Matching, Sockets | At Least Once | SESSION | `sessionId` |
| `session.assigned` | DispatchEngine | Tracking, Sockets | At Least Once | SESSION | `sessionId` |
| `session.arrived` | GeofenceAuditor | Tracking, Sockets | At Least Once | SESSION | `sessionId` |
| `session.started` | SessionService | TrackingEngine | At Least Once | SESSION | `sessionId` |
| `session.completed` | SessionService | ReportGen, Billing | At Least Once | SESSION | `sessionId` |
| `session.cancelled` | SessionService | Fanout, Sockets | At Least Once | SESSION | `sessionId` |
| `session.driver_lost` | PresenceMonitor | DispatchEngine | At Least Once | SESSION | `sessionId` |
| `dispatch.wave.started` | FanoutEngine | SocketServer | At Least Once | SESSION | `sessionId` |
| `dispatch.wave.completed` | FanoutEngine | SessionService | At Least Once | SESSION | `sessionId` |
| `dispatch.no_driver_found` | MatchingEngine | SessionService | At Least Once | SESSION | `sessionId` |

---

## Export Reference

This package is a dual-module target supporting standard module loaders:

```json
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js",
    "require": "./dist/index.cjs"
  }
}
```

Import syntax triggers ES Modules (`index.js`). Require syntax triggers CommonJS Module (`index.cjs`). TypeScript compiler processes types (`index.d.ts`) matching standard environments.

---

## Migration Notes

### Upgrading to v1

1. **Enum Renaming:**
   - Replace all usage of `SessionStatus` with `SessionState`.
   - Update state check statements from:
     ```typescript
     if (session.status === SessionStatus.IN_PROGRESS)
     ```
     to:
     ```typescript
     import { SessionState } from '@motus/types';
     if (session.status === SessionState.IN_PROGRESS)
     ```

2. **Command / Query Inputs Conversion:**
   - API inputs are structured as Commands (`*Command`) and Queries (`*Query`) rather than REST-biased Requests.
   - Outputs are structured as Results (`*Result`) rather than Responses.

3. **Tenant-Defined Vehicle Classification:**
   - Built-in vehicle enum presets have been removed. Use string-based codes matching custom tenant classifications (e.g. `"CARGO_VAN"`, `"BICYCLE"`).
