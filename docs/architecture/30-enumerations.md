# 30 - Enumerations

This document defines the core platform-independent enumerations of the Motus system. It specifies the values, purposes, serialization standards, and rules for future extensions.

---

## Enumeration Specifications

### 1. DriverStatus
Defines the connection and presence state of a driver in the real-time presence engine.
*   **Values & Purpose:**
    *   `OFFLINE`: The driver is not connected, does not stream location, and cannot receive wave offers.
    *   `ONLINE`: The driver is actively connected, streaming locations, and available to receive matching wave offers.
    *   `BUSY`: The driver is active but has reached maximum concurrent capacity load. No new offers are sent.
    *   `PAUSED`: The driver is connected but temporarily unavailable to accept wave offers.
    *   `STALE`: The driver has failed to send a heartbeat within the stale timeout threshold. The engine is waiting in a recovery window before transitioning them to `OFFLINE`.
*   **Serialization Rules:** Must serialize as uppercase strings. Integer values should not be used in external APIs to avoid sequencing conflicts.
*   **Examples:** `"ONLINE"`, `"STALE"`

### 2. SessionStatus
Defines the sequential lifecycle states of a tracking and dispatch session.
*   **Values & Purpose:**
    *   `CREATED`: The session has been successfully registered but matching has not yet commenced.
    *   `SEARCHING`: The matching engine is currently running and executing waves of offers to candidate drivers.
    *   `DRIVER_ASSIGNED`: A driver has accepted the wave offer and is reserved for the session.
    *   `DRIVER_EN_ROUTE`: The driver is travelling to the session origin point.
    *   `ARRIVED`: The driver has arrived at the session origin coordinate.
    *   `IN_PROGRESS`: The driver has picked up the passenger/cargo and is en route to the destination.
    *   `COMPLETED`: The session has successfully reached its destination and is finished.
    *   `CANCELLED`: The session was terminated early by the tenant, driver, or system.
    *   `DRIVER_LOST`: The assigned driver disconnected during fulfillment, putting the session in a recovery window.
*   **Serialization Rules:** Must serialize as uppercase strings.
*   **Examples:** `"DRIVER_EN_ROUTE"`, `"DRIVER_LOST"`

### 3. MatchingStrategy
The algorithm strategy used by the matching engine to score and rank driver candidates.
*   **Values & Purpose:**
    *   `DISTANCE`: Ranks candidates based on straight-line (Haversine) distance from the session pickup point.
    *   `ETA`: Ranks candidates using routing road-network travel time calculations from a pluggable routing service.
    *   `CUSTOM`: Uses a user-configured matching plugin to score and filter candidates.
*   **Serialization Rules:** Must serialize as uppercase strings.
*   **Examples:** `"DISTANCE"`, `"ETA"`

### 4. TelemetryProfile
Configures the location ingestion sampling filters, controlling bandwidth vs coordinate accuracy trade-offs.
*   **Values & Purpose:**
    *   `LOW_FREQUENCY`: Minimal updates. Samples coordinates every $60$ seconds or $200$ meters of movement.
    *   `BALANCED`: Standard operational setting. Samples every $10$ seconds or $25$ meters of movement.
    *   `HIGH_ACCURACY`: Maximum precision tracking. Ingests all points without filtering, or samples every $2$ seconds or $5$ meters.
*   **Serialization Rules:** Must serialize as uppercase strings.
*   **Examples:** `"BALANCED"`

### 5. DispatchWaveStatus
Represents the current state of a progressive candidate matching notification wave.
*   **Values & Purpose:**
    *   `ACTIVE`: The wave is ongoing; candidate drivers are receiving notifications and can accept or reject the offer.
    *   `COMPLETED`: A candidate driver accepted the offer, successfully terminating the wave.
    *   `EXPIRED`: The wave timeout window elapsed without any candidate driver accepting the offer.
*   **Serialization Rules:** Must serialize as uppercase strings.
*   **Examples:** `"ACTIVE"`, `"EXPIRED"`

### 6. DriverLostReason
Indicates why a driver presence transitioned to `DRIVER_LOST` or `STALE`.
*   **Values & Purpose:**
    *   `HEARTBEAT_MISSING`: No WebSocket heartbeat frames were received within the configured stale window threshold.
    *   `CLIENT_DISCONNECT`: The driver client app sent an explicit disconnect or socket close frame.
    *   `CONNECTION_TIMEOUT`: The underlying TCP connection dropped without an orderly closure.
*   **Serialization Rules:** Must serialize as uppercase strings.
*   **Examples:** `"HEARTBEAT_MISSING"`

### 7. ErrorCode
Standardized error identifiers returned by the API and SDK.
*   **Values & Purpose:**
    *   `MOTUS_DRIVER_NOT_FOUND`: The requested driver profile does not exist.
    *   `MOTUS_SESSION_NOT_FOUND`: The requested dispatch session does not exist.
    *   `MOTUS_INVALID_TRANSITION`: The state machine rejected the requested state change.
    *   `MOTUS_DRIVER_BUSY`: The target driver cannot accept the assignment due to load capacity.
    *   `MOTUS_CAPACITY_EXCEEDED`: The tenant configuration limits have been exceeded.
    *   `MOTUS_INVALID_VEHICLE_TYPE`: The driver's vehicle does not match session requirements.
    *   `MOTUS_LOCK_ACQUISITION_FAILED`: Could not book an exclusive lock on the session or driver resource.
    *   `MOTUS_INVALID_ARGUMENT`: Input payload validation checks failed.
    *   `MOTUS_UNAUTHORIZED`: Invalid or missing credentials.
    *   `MOTUS_INTERNAL_ERROR`: Generic system malfunction code.
*   **Serialization Rules:** Must serialize as uppercase strings.
*   **Examples:** `"MOTUS_INVALID_TRANSITION"`

---

## Future Compatibility & Extension Rules

To support seamless updates of the Motus system, all consumers of these enums must adhere to the following rules:
1.  **Unknown Value Handling:** Client implementations must handle unknown enum values gracefully. If a new state is added (e.g. `DRIVER_BREAK` in `DriverStatus`), client SDKs must treat it as a generic fallback or log a warning rather than crashing.
2.  **No Value Re-assignment:** Once a value is added to an enum, its semantic meaning must not change.
3.  **No Deletions or Re-ordering:** Enum values must not be removed. If a value becomes obsolete, it should be marked as deprecated, but left in the enum definition to prevent client deserialization issues.

---

## Versioning Considerations

### Versioning Policy for Enums
*   **Additive Changes:** Adding a new value to an enum is a minor version change. Client SDKs must be implemented to forward-compatibly ignore unknown values.
*   **Breaking Changes:** Renaming an existing value, changing its spelling (e.g., `OFFLINE` to `DISCONNECTED`), or deleting a value is a major breaking change.
*   **Deprecation Rules:** Deprecated values will be marked in specifications as `[DEPRECATED]` and removed from active system logic, but kept in the schema parser definitions for compatibility with old logs/records.
