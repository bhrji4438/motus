# 34 - Event Contracts

This document establishes the canonical event catalog and event ownership specifications for the Motus platform. It defines payload schemas, ordering constraints, partitioning keys, and consumption metrics for all asynchronous domain events.

---

## Event Summary Matrices

These matrices group the event catalog by logical domain boundaries.

### 1. Tenant Events
| Event Name | Category | Version | Producer | Consumers | Partition Key | Ordering Scope | Delivery Guarantee |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `tenant.created` | Admin | v1 | Tenant Service | Billing Engine, Socket Server | `tenantId` | Tenant | At Least Once |

### 2. Driver Events
| Event Name | Category | Version | Producer | Consumers | Partition Key | Ordering Scope | Delivery Guarantee |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `driver.online` | Presence | v1 | Presence Engine | Matching Engine, Sockets | `driverId` | Driver | At Least Once |
| `driver.offline` | Presence | v1 | Presence Engine | Dispatch Engine, Sockets | `driverId` | Driver | At Least Once |
| `driver.paused` | Presence | v1 | Presence Engine | Matching Engine | `driverId` | Driver | At Least Once |

### 3. Telemetry Events
| Event Name | Category | Version | Producer | Consumers | Partition Key | Ordering Scope | Delivery Guarantee |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `driver.location.updated` | Telemetry | v1 | Location Ingestion | Geofence Auditor, Sockets | `driverId` | Driver | At Most Once |
| `telemetry.sampled` | Telemetry | v1 | Telemetry Sampler | Session History, Sockets | `sessionId` | Session | At Least Once |

### 4. Session Events
| Event Name | Category | Version | Producer | Consumers | Partition Key | Ordering Scope | Delivery Guarantee |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `session.created` | Session | v1 | Session Service | Matching Engine, Sockets | `sessionId` | Session | At Least Once |
| `session.searching` | Session | v1 | Dispatch Engine | Matching Engine, Sockets | `sessionId` | Session | At Least Once |
| `session.assigned` | Session | v1 | Dispatch Engine | Tracking Engine, Sockets | `sessionId` | Session | At Least Once |
| `session.arrived` | Session | v1 | Geofence Auditor | Tracking Engine, Sockets | `sessionId` | Session | At Least Once |
| `session.started` | Session | v1 | Session Service | Tracking Engine, Sockets | `sessionId` | Session | At Least Once |
| `session.completed` | Session | v1 | Session Service | Report Generator, Sockets | `sessionId` | Session | At Least Once |
| `session.cancelled` | Session | v1 | Session Service | Fanout Engine, Sockets | `sessionId` | Session | At Least Once |
| `session.driver_lost` | Session | v1 | Presence Monitor | Dispatch Engine, Sockets | `sessionId` | Session | At Least Once |

### 5. Dispatch Events
| Event Name | Category | Version | Producer | Consumers | Partition Key | Ordering Scope | Delivery Guarantee |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `dispatch.wave.started` | Dispatch | v1 | Fanout Engine | Socket Server, Sockets | `sessionId` | Session | At Least Once |
| `dispatch.wave.completed` | Dispatch | v1 | Fanout Engine | Session Service, Sockets | `sessionId` | Session | At Least Once |
| `dispatch.no_driver_found` | Dispatch | v1 | Matching Engine | Session Service, Sockets | `sessionId` | Session | At Least Once |

---

## Canonical Event Specifications

### 1. `tenant.created`
*   **Event Name:** `tenant.created`
*   **Event Category:** Tenant Admin
*   **Event Version:** `1.0.0`
*   **Event Producer:** Tenant Administration Service
*   **Event Consumers:** Billing Engine, Socket server instance coordinators.
*   **Event Payload:**
    *   `tenantId` (String): Prefix `tnt_`.
    *   `name` (String): Tenant company name.
    *   `timestamp` (String): UTC ISO 8601 initialization time.
*   **Ordering Scope:** Partitioned by Tenant ID.
*   **Partition Key:** `tenantId`
*   **Delivery Guarantee:** At Least Once.
*   **Retry Behavior:** Exponential backoff on consumption failures. Max 5 retries before forwarding to DLQ (Dead Letter Queue).
*   **Idempotency Requirements:** Consumer must track event ID to prevent duplicate database initialization.
*   **Payload Example:**
    ```json
    {
      "eventId": "e838cf02-124b-4a5c-bb17-64213717df3d",
      "eventName": "tenant.created",
      "timestamp": "2026-06-11T13:00:00.000Z",
      "payload": {
        "tenantId": "tnt_quickdelivery",
        "name": "QuickDelivery Logistics"
      }
    }
    ```

### 2. `driver.online`
*   **Event Name:** `driver.online`
*   **Event Category:** Presence State
*   **Event Version:** `1.0.0`
*   **Event Producer:** Driver Presence Service
*   **Event Consumers:** Matching Pipeline coordinator.
*   **Event Payload:**
    *   `tenantId` (String)
    *   `driverId` (String)
    *   `capacity` (Integer)
*   **Ordering Scope:** Sequential per Driver ID.
*   **Partition Key:** `driverId`
*   **Delivery Guarantee:** At Least Once.
*   **Retry Behavior:** Re-try up to 3 times. If presence synchronization fails, driver status defaults to offline on query.
*   **Idempotency Requirements:** Deduplicate by payload state timestamp to ignore late-arriving offline events.

### 3. `driver.offline`
*   **Event Name:** `driver.offline`
*   **Event Category:** Presence State
*   **Event Version:** `1.0.0`
*   **Event Producer:** Driver Presence Service
*   **Event Consumers:** Dispatch Session Coordinator, Active Wave engines.
*   **Event Payload:**
    *   `tenantId` (String)
    *   `driverId` (String)
    *   `reason` (String): `MANUAL_DISCONNECT` or `HEARTBEAT_TIMEOUT`.
*   **Ordering Scope:** Partitioned by Driver ID.
*   **Partition Key:** `driverId`
*   **Delivery Guarantee:** At Least Once.
*   **Retry Behavior:** Retry up to 3 times. If failures persist, trigger dead-letter logic.

### 4. `driver.paused`
*   **Event Name:** `driver.paused`
*   **Event Category:** Presence State
*   **Event Version:** `1.0.0`
*   **Event Producer:** Driver Presence Service
*   **Event Consumers:** Matching Pipeline engine.
*   **Event Payload:**
    *   `tenantId` (String)
    *   `driverId` (String)
*   **Ordering Scope:** Partitioned by Driver ID.
*   **Partition Key:** `driverId`
*   **Delivery Guarantee:** At Least Once.

### 5. `driver.location.updated`
*   **Event Name:** `driver.location.updated`
*   **Event Category:** Telemetry Ingestion
*   **Event Version:** `1.0.0`
*   **Event Producer:** Ingestion Server
*   **Event Consumers:** Geofence auditor, realtime tracker sockets.
*   **Event Payload:**
    *   `tenantId` (String)
    *   `driverId` (String)
    *   `location` (Coordinates)
    *   `speed` (Double)
    *   `bearing` (Double)
*   **Ordering Scope:** Partitioned by Driver ID.
*   **Partition Key:** `driverId`
*   **Delivery Guarantee:** At Most Once (High-frequency telemetry drop is preferred over latency queues).
*   **Retry Behavior:** No retries. Stale locations are discarded in favor of newer updates.

### 6. `telemetry.sampled`
*   **Event Name:** `telemetry.sampled`
*   **Event Category:** Cleaned Telemetry Route
*   **Event Version:** `1.0.0`
*   **Event Producer:** Telemetry Sampler Engine
*   **Event Consumers:** Historical Route archiver.
*   **Event Payload:**
    *   `tenantId` (String)
    *   `sessionId` (String)
    *   `driverId` (String)
    *   `location` (Coordinates)
*   **Ordering Scope:** Sequential per Session ID.
*   **Partition Key:** `sessionId`
*   **Delivery Guarantee:** At Least Once.
*   **Retry Behavior:** Exponential backoff up to 5 times.

### 7. `session.created`
*   **Event Name:** `session.created`
*   **Event Category:** Session State
*   **Event Version:** `1.0.0`
*   **Event Producer:** Session Management Service
*   **Event Consumers:** Matching coordinator, client tracker sockets.
*   **Event Payload:**
    *   `tenantId` (String)
    *   `sessionId` (String)
    *   `pickup` (Coordinates)
    *   `destination` (Coordinates)
*   **Ordering Scope:** Partitioned by Session ID.
*   **Partition Key:** `sessionId`
*   **Delivery Guarantee:** At Least Once.

### 8. `session.searching`
*   **Event Name:** `session.searching`
*   **Event Category:** Session State
*   **Event Version:** `1.0.0`
*   **Event Producer:** Dispatch Engine
*   **Event Consumers:** Matching Service, Wave Engine.
*   **Event Payload:**
    *   `tenantId` (String)
    *   `sessionId` (String)
*   **Ordering Scope:** Partitioned by Session ID.
*   **Partition Key:** `sessionId`
*   **Delivery Guarantee:** At Least Once.

### 9. `session.assigned`
*   **Event Name:** `session.assigned`
*   **Event Category:** Session State
*   **Event Version:** `1.0.0`
*   **Event Producer:** Dispatch Engine
*   **Event Consumers:** Telemetry tracker, Driver Notification broker.
*   **Event Payload:**
    *   `tenantId` (String)
    *   `sessionId` (String)
    *   `assignedDriverId` (String)
    *   `estimatedDurationSeconds` (Integer)
*   **Ordering Scope:** Partitioned by Session ID.
*   **Partition Key:** `sessionId`
*   **Delivery Guarantee:** At Least Once.

### 10. `session.arrived`
*   **Event Name:** `session.arrived`
*   **Event Category:** Session State
*   **Event Version:** `1.0.0`
*   **Event Producer:** Geofence Auditor Engine
*   **Event Consumers:** Tracking manager, Notification broker.
*   **Event Payload:**
    *   `tenantId` (String)
    *   `sessionId` (String)
    *   `driverId` (String)
*   **Ordering Scope:** Partitioned by Session ID.
*   **Partition Key:** `sessionId`
*   **Delivery Guarantee:** At Least Once.

### 11. `session.started`
*   **Event Name:** `session.started`
*   **Event Category:** Session State
*   **Event Version:** `1.0.0`
*   **Event Producer:** Session Management Service
*   **Event Consumers:** Tracking manager.
*   **Event Payload:**
    *   `tenantId` (String)
    *   `sessionId` (String)
    *   `driverId` (String)
*   **Ordering Scope:** Partitioned by Session ID.
*   **Partition Key:** `sessionId`
*   **Delivery Guarantee:** At Least Once.

### 12. `session.completed`
*   **Event Name:** `session.completed`
*   **Event Category:** Session State
*   **Event Version:** `1.0.0`
*   **Event Producer:** Session Management Service
*   **Event Consumers:** Report compiler, billing worker.
*   **Event Payload:**
    *   `tenantId` (String)
    *   `sessionId` (String)
    *   `driverId` (String)
*   **Ordering Scope:** Partitioned by Session ID.
*   **Partition Key:** `sessionId`
*   **Delivery Guarantee:** At Least Once.

### 13. `session.cancelled`
*   **Event Name:** `session.cancelled`
*   **Event Category:** Session State
*   **Event Version:** `1.0.0`
*   **Event Producer:** Session Management Service
*   **Event Consumers:** Wave manager, driver lock broker.
*   **Event Payload:**
    *   `tenantId` (String)
    *   `sessionId` (String)
    *   `reason` (String)
*   **Ordering Scope:** Partitioned by Session ID.
*   **Partition Key:** `sessionId`
*   **Delivery Guarantee:** At Least Once.

### 14. `session.driver_lost`
*   **Event Name:** `session.driver_lost`
*   **Event Category:** Session State
*   **Event Version:** `1.0.0`
*   **Event Producer:** Presence Monitoring Engine
*   **Event Consumers:** Dispatch Coordinator.
*   **Event Payload:**
    *   `tenantId` (String)
    *   `sessionId` (String)
    *   `lastKnownLocation` (Coordinates)
*   **Ordering Scope:** Partitioned by Session ID.
*   **Partition Key:** `sessionId`
*   **Delivery Guarantee:** At Least Once.

### 15. `dispatch.wave.started`
*   **Event Name:** `dispatch.wave.started`
*   **Event Category:** Matching Engine
*   **Event Version:** `1.0.0`
*   **Event Producer:** Fanout Engine
*   **Event Consumers:** Sockets Notification Gateway.
*   **Event Payload:**
    *   `tenantId` (String)
    *   `sessionId` (String)
    *   `waveNumber` (Integer)
    *   `candidates` (Array of Strings)
    *   `expiresAt` (String)
*   **Ordering Scope:** Partitioned by Session ID.
*   **Partition Key:** `sessionId`
*   **Delivery Guarantee:** At Least Once.

### 16. `dispatch.wave.completed`
*   **Event Name:** `dispatch.wave.completed`
*   **Event Category:** Matching Engine
*   **Event Version:** `1.0.0`
*   **Event Producer:** Fanout Engine
*   **Event Consumers:** Session state manager.
*   **Event Payload:**
    *   `tenantId` (String)
    *   `sessionId` (String)
    *   `waveNumber` (Integer)
    *   `acceptedDriverId` (String)
*   **Ordering Scope:** Partitioned by Session ID.
*   **Partition Key:** `sessionId`
*   **Delivery Guarantee:** At Least Once.

### 17. `dispatch.no_driver_found`
*   **Event Name:** `dispatch.no_driver_found`
*   **Event Category:** Matching Engine
*   **Event Version:** `1.0.0`
*   **Event Producer:** Matching Pipeline
*   **Event Consumers:** Session state manager (cancels or escalates session).
*   **Event Payload:**
    *   `tenantId` (String)
    *   `sessionId` (String)
*   **Ordering Scope:** Partitioned by Session ID.
*   **Partition Key:** `sessionId`
*   **Delivery Guarantee:** At Least Once.

---

## Backward Compatibility Rules

To support rolling version updates:
1.  **Additive Rule:** Field additions to payloads must be marked as optional. Removing fields or changing field types (e.g. changing string ID to structured object) is forbidden in minor releases.
2.  **Unknown Field Discarding:** Consumer parsing code must silently ignore and drop any unrecognized fields present in event JSON structures.
3.  **Name Stability:** Event names (e.g., `session.assigned`) are immutable once published. Changes in event naming rules will generate new major versions of the event schemas.

---

## Versioning Considerations

### Versioning Policy for Events
*   **Additive Changes:** Non-breaking. Adding new fields is a minor version change (`v1.1.0` to `v1.2.0`). Older consumers can ignore the new fields.
*   **Breaking Changes:** Breaking. Changing a field type or deleting a field triggers a major contract version increment (e.g. `session.assigned` v1 to v2).
*   **Deprecation Rules:** When deprecating a field, it will be marked as obsolete for at least six months. During this period, the system will populate both the deprecated field and its replacement.
*   **Compatibility Matrix:** The event broker metadata envelopes must contain version identifiers to allow consumers to route messages to appropriate schema parsers.
