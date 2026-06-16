# 32 - Request Contracts

This document defines the request contracts for all operations exposed by the Motus platform. It specifies field requirements, data validation constraints, and the system-wide idempotency protocols.

---

## Idempotency Contract Rules

To ensure reliable execution over unreliable networks, Motus implements a strict idempotency contract for state-mutating command operations.

### 1. Operations Requiring Idempotency
All creation and state-transition commands must support idempotency validation. Read-only queries and pure location update ingestion do not require idempotency processing.
*   `registerTenant` (Creation)
*   `registerDriver` (Creation)
*   `createSession` (Creation)
*   `cancelSession` (Transition)
*   `completeSession` (Transition)
*   `reassignSession` (Transition)

### 2. Idempotency Key Location
*   **HTTP REST APIs:** Conveyed via the standard header:
    `Idempotency-Key: <unique-uuid-or-string>`
*   **WebSockets:** Conveyed as a metadata attribute inside the request payload wrapping envelope:
    `{ "idempotencyKey": "<unique-uuid-or-string>", "payload": { ... } }`

### 3. Duplicate Request & Replay Behavior
*   **In-Flight Requests:** If a secondary request arrives with an active, duplicate idempotency key while the initial transaction is executing, the server rejects it with code `MOTUS_LOCK_ACQUISITION_FAILED` (indicating a lock collision).
*   **Completed Requests:** If a request arrives with a key matching a successfully processed transaction, the server skips execution and replays the cached response from the previous transaction.

### 4. Expiration & Retention Expectations
*   Idempotency metadata and execution responses are retained in low-latency memory for a minimum of **24 hours** from initial processing. After 24 hours, the key expires, and a duplicate request using that key is treated as a new transaction.

### 5. Error Behavior for Conflicting Requests
*   If a request contains a duplicate key but changes the actual payload content (i.e. a key collision with differing inputs), the server rejects it with error code `MOTUS_INVALID_ARGUMENT`, stating the payload does not match the cached request.

---

## Request Contract Specifications

### 1. RegisterTenantRequest
Registers a new tenant tenant-boundary workspace in the Motus runtime.
*   **Fields:**
    *   `name` (String, Required): Name of the tenant. Length range: $[3, 100]$.
    *   `matchingStrategy` (String, Required): One of `DISTANCE`, `ETA`, `CUSTOM`. Default: `DISTANCE`.
    *   `waveTimeoutSeconds` (Integer, Optional): Default: `10`. Range: $[5, 60]$.
    *   `maxCapacityPerDriver` (Integer, Optional): Default: `1`. Range: $[1, 20]$.
    *   `geofences` (Array of Polygons, Optional): Service boundary perimeters.
*   **Illustrative Example:**
    ```json
    {
      "name": "QuickDelivery Logistics",
      "matchingStrategy": "ETA",
      "waveTimeoutSeconds": 15,
      "maxCapacityPerDriver": 2,
      "geofences": [
        {
          "name": "Downtown Area",
          "boundary": [
            { "latitude": 37.77, "longitude": -122.41 },
            { "latitude": 37.79, "longitude": -122.41 },
            { "latitude": 37.79, "longitude": -122.39 },
            { "latitude": 37.77, "longitude": -122.41 }
          ]
        }
      ]
    }
    ```

### 2. RegisterDriverRequest
Initializes a new driver profile ready for presence tracking.
*   **Fields:**
    *   `tenantId` (String, Required): Target tenant ID. Matches format `tnt_[a-zA-Z0-9_-]{1,60}`.
    *   `driverId` (String, Required): ID to register. Matches format `drv_[a-zA-Z0-9_-]{1,60}`.
    *   `capacity` (Integer, Optional): Default: `1`. Range: $[1, 10]$.
    *   `vehicleType` (String, Required): Must conform to `VehicleType` rules.
*   **Illustrative Example:**
    ```json
    {
      "tenantId": "tnt_quickdelivery",
      "driverId": "drv_driver409",
      "capacity": 1,
      "vehicleType": "SEDAN"
    }
    ```

### 3. UpdateDriverLocationRequest
Pushes a real-time coordinate update into the location ingestion layer.
*   **Fields:**
    *   `tenantId` (String, Required): Associated tenant ID.
    *   `driverId` (String, Required): Associated driver ID.
    *   `latitude` (Double, Required): Range: $[-90.0, 90.0]$.
    *   `longitude` (Double, Required): Range: $[-180.0, 180.0]$.
    *   `accuracy` (Double, Optional): Precision of reading in meters. Default: `0.0`.
    *   `bearing` (Double, Optional): Direction of travel. Range: $[0.0, 360.0]$.
    *   `speed` (Double, Optional): In meters/sec. Range: $[0.0, 100.0]$.
    *   `timestamp` (String, Required): UTC ISO 8601 string.
*   **Illustrative Example:**
    ```json
    {
      "tenantId": "tnt_quickdelivery",
      "driverId": "drv_driver409",
      "latitude": 37.774929,
      "longitude": -122.419416,
      "accuracy": 4.2,
      "bearing": 180.0,
      "speed": 12.5,
      "timestamp": "2026-06-11T13:12:00.000Z"
    }
    ```

### 4. CreateSessionRequest
Registers a new session to initiate the matching process.
*   **Fields:**
    *   `tenantId` (String, Required): Target tenant ID.
    *   `sessionId` (String, Required): Unique ID for the session. Format: `ses_[a-zA-Z0-9_-]{1,60}`.
    *   `pickup` (Coordinates, Required): Origin coordinate block.
    *   `destination` (Coordinates, Required): Destination coordinate block.
    *   `requiredVehicleType` (String, Optional): Vehicle type constraint.
*   **Illustrative Example:**
    ```json
    {
      "tenantId": "tnt_quickdelivery",
      "sessionId": "ses_trip2841",
      "pickup": { "latitude": 37.7749, "longitude": -122.4194 },
      "destination": { "latitude": 37.7892, "longitude": -122.4014 },
      "requiredVehicleType": "SEDAN"
    }
    ```

### 5. CompleteSessionRequest
Concludes an active session.
*   **Fields:**
    *   `tenantId` (String, Required): Associated tenant.
    *   `sessionId` (String, Required): Target session ID.
*   **Illustrative Example:**
    ```json
    {
      "tenantId": "tnt_quickdelivery",
      "sessionId": "ses_trip2841"
    }
    ```

### 6. ReassignSessionRequest
Removes the current driver and forces re-evaluation of the matching wave.
*   **Fields:**
    *   `tenantId` (String, Required): Associated tenant.
    *   `sessionId` (String, Required): Target session.
    *   `reason` (String, Optional): Maximum 255 characters.
*   **Illustrative Example:**
    ```json
    {
      "tenantId": "tnt_quickdelivery",
      "sessionId": "ses_trip2841",
      "reason": "Driver vehicle mechanical failure"
    }
    ```

---

## Versioning Considerations

### Versioning Policy for Request Contracts
*   **Additive Changes:** Adding optional properties to a request contract is non-breaking. Default values must be defined for any new optional parameters to ensure old clients function seamlessly.
*   **Breaking Changes:** Adding a new required parameter, modifying type boundaries (e.g. converting a parameter from string to object), or modifying validation constraints (e.g. reducing the max timeout range) constitutes a breaking change.
*   **Deprecation Rules:** When deprecating a parameter, it must be marked in the payload contract as optional and preserved in runtime schemas for backward compatibility. It should be decommissioned only in major release cycles.
*   **Forward Compatibility:** Request routing handlers must check API versions using HTTP content-type or custom headers (e.g., `Accept: application/vnd.motus.v1+json`) to route requests to appropriate contract version parsers.
