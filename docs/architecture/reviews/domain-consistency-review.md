# Domain Model Consistency Review

## Current State
The domain model in `02-domain-model.md` lists `DriverPresenceProfile`, `DispatchSession`, and `TenantProfile` as aggregate roots. However, it lacks details explaining why these boundaries were drawn, which operations require immediate transaction consistency, and what constraints/invariants are enforced.

---

## Findings

### Why is `DriverPresenceProfile` an Aggregate Root?
*   **Encapsulation of Availability State:** A driver's presence (status, current capacity, active load, heartbeat timestamp) represents a distinct transactional unit. availability changes must follow strict invariants (e.g. changing status to `BUSY` when `currentLoad >= capacity`).
*   **Independent Lifecycle:** A driver presence profile exists and changes independently of active dispatch sessions.

### Why is `DispatchSession` an Aggregate Root?
*   **Lifecycle Isolation:** A session represents a transient dispatch journey. It maintains its own state progression (CREATED -> SEARCHING -> etc.) and encloses dependent child entities (active wave records, event timelines, telemetry coordinates).
*   **Single Writer Principle:** Only one processes should modify a session at a time to prevent conflicting state shifts.

### Transaction Boundaries & Atomicity

#### A. Atomic Operations (Immediate Consistency Required)
1.  **Offer Acceptance:** The driver's `currentLoad` must increment, status must transition to `BUSY` (if at capacity limit), and the session's state must change to `DRIVER_ASSIGNED` with `assignedDriverId` populated. This must occur inside a single atomic operation (via the Redis Lua script) to prevent double-booking.
2.  **Driver Lost Transition:** When a driver presence status is changed to `STALE` by the presence checker, the assigned session state must transition to `DRIVER_LOST` and cache the `previousSessionState` atomically.

#### B. Eventually Consistent Operations
1.  **Telemetry Archival:** Ingesting coordinates and adding them to the telemetry stream doesn't require immediate updates to the main session state. Telemetry updates run in a separate pipeline.
2.  **Outbox Event Dispatching:** Events emitted by state transitions are written to an outbox stream first and published to external brokers (Kafka/RabbitMQ) asynchronously.
3.  **Report Compilations:** Replay reports are compiled after the session is completed or cancelled.

---

## Risks
*   **Double-Booking Overlaps:** If offer acceptance is not handled atomically, multiple concurrent wave selections could assign the same driver to different sessions.
*   **Disconnected Orphan States:** If a driver drops offline and their presence is marked `STALE` but the active session fails to transition to `DRIVER_LOST`, the session remains stuck in progress, causing a deadlock.

---

## Recommended Changes

### A. Add Missing Invariants
We define four core validation invariants that must be enforced by the domain services:
1.  **Capacity Invariant:** `driver.currentLoad` cannot exceed `driver.capacity`. An offer acceptance must be rejected if this rule is violated.
2.  **State Compatibility Invariant:** A session state transition can only execute if the new state is listed as a valid target for the current state in the `SessionStateMachine` transition matrix.
3.  **Geofence Validation Invariant:** A session cannot transition to `SEARCHING` if the pickup coordinate is outside the tenant's active geofenced boundaries.
4.  **Offer Lock Invariant:** A driver cannot accept an offer if the `OfferReservation` lock has expired or has been claimed by another session.

---

## Final Decision
Maintain `DriverPresenceProfile` and `DispatchSession` as distinct aggregate roots. Enforce strict transactional boundaries between them using Redis Lua scripts for offer acceptances, and rely on eventual consistency via event channels for telemetry and report generation.

---

## Impact Analysis
*   **Correctness:** Eliminates state machine deadlocks and double-booking race conditions during high-volume dispatches.
*   **Performance:** Decoupling telemetry tracking from session transactions prevents I/O bottlenecks during coordinate updates.
