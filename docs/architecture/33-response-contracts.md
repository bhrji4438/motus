# 33 - Response Contracts

This document defines the response contracts for all query and command actions processed by the Motus engine. It establishes structural field requirements, optional attributes, and the API versioning strategy.

---

## Response Versioning Strategy

To support non-disruptive, contract-first evolutions, Motus uses a standardized response versioning policy:
1.  **Semantic Version Headers:** Every HTTP response includes the API version payload schema definition via headers:
    `X-Motus-Contract-Version: 1.0.0`
    `Content-Type: application/vnd.motus.v1+json`
2.  **Envelope Format Consistency:** Command responses return a standardized wrapper containing transactional metadata (timestamps, request ID correlation) alongside the domain response entity.
3.  **Forward Compatibility Rules:** Clients must ignore unrecognized properties when parsing response JSON.

---

## Response Contract Specifications

### 1. TenantResponse
Returned by all tenant administration APIs.
*   **Fields:**
    *   `id` (String, Required): Registered Tenant ID.
    *   `name` (String, Required): Human-readable name.
    *   `matchingStrategy` (String, Required): One of `DISTANCE`, `ETA`, `CUSTOM`.
    *   `waveTimeoutSeconds` (Integer, Required): The period of wave offer availability.
    *   `maxCapacityPerDriver` (Integer, Required): Maximum concurrent tasks.
    *   `geofences` (Array, Required): List of active service zone boundaries.
*   **Illustrative Example:**
    ```json
    {
      "id": "tnt_quickdelivery",
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

### 2. DriverResponse
Returned by driver presence and configuration APIs.
*   **Fields:**
    *   `id` (String, Required): Driver ID.
    *   `tenantId` (String, Required): Tenant ID.
    *   `status` (String, Required): Core presence status. Matches `DriverStatus`.
    *   `capacity` (Integer, Required): Capacity threshold.
    *   `currentLoad` (Integer, Required): Active concurrent jobs.
    *   `vehicleType` (String, Required): Matches `VehicleType`.
    *   `lastLocation` (Coordinates, Optional): Last registered coordinate object.
    *   `lastHeartbeat` (String, Required): UTC ISO 8601 string.
*   **Illustrative Example:**
    ```json
    {
      "id": "drv_driver409",
      "tenantId": "tnt_quickdelivery",
      "status": "ONLINE",
      "capacity": 1,
      "currentLoad": 0,
      "vehicleType": "SEDAN",
      "lastLocation": {
        "latitude": 37.774929,
        "longitude": -122.419416
      },
      "lastHeartbeat": "2026-06-11T13:12:00.000Z"
    }
    ```

### 3. SessionResponse
Returned by session lifecycle, command, and retrieval endpoints.
*   **Fields:**
    *   `id` (String, Required): Session ID.
    *   `tenantId` (String, Required): Tenant ID.
    *   `status` (String, Required): Current state in lifecycle. Matches `SessionStatus`.
    *   `assignedDriverId` (String, Optional): ID of the driver reserved or fulfilling the session.
    *   `pickup` (Coordinates, Required): Origin coordinates.
    *   `destination` (Coordinates, Required): Destination coordinates.
    *   `createdAt` (String, Required): UTC creation timestamp.
    *   `updatedAt` (String, Required): UTC last modification timestamp.
*   **Illustrative Example:**
    ```json
    {
      "id": "ses_trip2841",
      "tenantId": "tnt_quickdelivery",
      "status": "DRIVER_ASSIGNED",
      "assignedDriverId": "drv_driver409",
      "pickup": { "latitude": 37.7749, "longitude": -122.4194 },
      "destination": { "latitude": 37.7892, "longitude": -122.4014 },
      "createdAt": "2026-06-11T13:10:00.000Z",
      "updatedAt": "2026-06-11T13:11:05.000Z"
    }
    ```

### 4. SessionReportResponse
Final compiled report representing a completed session.
*   **Fields:**
    *   `sessionId` (String, Required): Reference session ID.
    *   `tenantId` (String, Required): Tenant ID.
    *   `startTime` (String, Required): UTC start timestamp.
    *   `endTime` (String, Required): UTC completion timestamp.
    *   `totalDistanceMeters` (Double, Required): Calculated distance.
    *   `totalDurationSeconds` (Integer, Required): Travel duration.
    *   `estimatedEtaSeconds` (Integer, Required): Baseline ETA recorded at matching time.
    *   `actualPath` (Array of Coordinates, Required): Filtered chronological coordinates tracking path.
*   **Illustrative Example:**
    ```json
    {
      "sessionId": "ses_trip2841",
      "tenantId": "tnt_quickdelivery",
      "startTime": "2026-06-11T13:11:05.000Z",
      "endTime": "2026-06-11T13:30:12.000Z",
      "totalDistanceMeters": 4210.5,
      "totalDurationSeconds": 1147,
      "estimatedEtaSeconds": 1200,
      "actualPath": [
        { "latitude": 37.7749, "longitude": -122.4194 },
        { "latitude": 37.7820, "longitude": -122.4100 },
        { "latitude": 37.7892, "longitude": -122.4014 }
      ]
    }
    ```

### 5. AssignmentResponse
Details the offer proposal state targeting a driver during a dispatch wave.
*   **Fields:**
    *   `sessionId` (String, Required): Session ID.
    *   `waveNumber` (Integer, Required): The wave index.
    *   `driverId` (String, Required): The candidate driver ID.
    *   `status` (String, Required): `PENDING`, `ACCEPTED`, `REJECTED`, `EXPIRED`.
    *   `expiresAt` (String, Required): ISO 8601 deadline.
*   **Illustrative Example:**
    ```json
    {
      "sessionId": "ses_trip2841",
      "waveNumber": 1,
      "driverId": "drv_driver409",
      "status": "PENDING",
      "expiresAt": "2026-06-11T13:11:20.000Z"
    }
    ```

### 6. EventResponse
Generic representation of historical events tracked on resource timelines.
*   **Fields:**
    *   `eventId` (String, Required): Unique event UUID.
    *   `eventName` (String, Required): Standard event name code.
    *   `timestamp` (String, Required): UTC ISO 8601 string.
    *   `payload` (Object, Required): JSON payload details mapping to event type catalog.
*   **Illustrative Example:**
    ```json
    {
      "eventId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "eventName": "session.assigned",
      "timestamp": "2026-06-11T13:11:05.000Z",
      "payload": {
        "sessionId": "ses_trip2841",
        "assignedDriverId": "drv_driver409",
        "waveNumber": 1
      }
    }
    ```

---

## Versioning Considerations

### Versioning Policy for Response Contracts
*   **Additive Changes:** Adding optional properties to a response payload is safe and does not break compatibility, as client models must ignore unexpected keys.
*   **Breaking Changes:** Renaming properties, deleting properties, or changing the data structures of existing fields (e.g. changing `actualPath` from an array of coordinates to an encoded polyline string) are breaking changes.
*   **Deprecation Rules:** Deprecated fields will remain populated in the response JSON structure for a minimum of two minor versions, and documentation will guide clients to migrate to the replacement fields.
*   **Backward/Forward Compatibility:** Server implementations must support content negotiations based on request version headers, returning appropriate payload structures.
