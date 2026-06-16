# 29 - Value Objects

This document defines the value objects within the Motus engine. Value objects are immutable domain concepts defined by their attributes rather than a persistent identity.

---

## Value Object Specifications

### 1. Coordinates
Represents a geographic location on the surface of the Earth.
*   **Logical Structure:** A compound structure containing:
    *   `latitude`: High-precision floating-point number.
    *   `longitude`: High-precision floating-point number.
*   **Validation Constraints:**
    *   `latitude` must be in the range $[-90.0, 90.0]$ (inclusive).
    *   `longitude` must be in the range $[-180.0, 180.0]$ (inclusive).
    *   Coordinates must adhere to the EPSG:4326 spatial reference system.
*   **Equivalence Rules:** Two coordinate objects are equivalent if and only if their latitude and longitude are identical up to 6 decimal places (approximately 0.11 meters of precision).
*   **Serialization Representation:** Represented in JSON as an object:
    ```json
    {
      "latitude": 37.774929,
      "longitude": -122.419416
    }
    ```

### 2. Distance
A geographic or travel distance measurement.
*   **Logical Structure:** A compound structure containing:
    *   `value`: Floating-point number.
    *   `unit`: A string representing the unit of measurement.
*   **Validation Constraints:**
    *   `value` must be greater than or equal to $0.0$.
    *   `unit` must be one of: `METERS`, `KILOMETERS`, `MILES`.
*   **Equivalence Rules:** Two distance objects are equivalent if their values, when converted to the same unit (meters as the canonical base unit), are identical.
*   **Serialization Representation:**
    ```json
    {
      "value": 1420.5,
      "unit": "METERS"
    }
    ```

### 3. Duration
A time span representing travel or waiting time.
*   **Logical Structure:** A compound structure containing:
    *   `value`: Integer.
    *   `unit`: A string representing the time scale.
*   **Validation Constraints:**
    *   `value` must be greater than or equal to $0$.
    *   `unit` must be one of: `SECONDS`, `MINUTES`, `HOURS`.
*   **Equivalence Rules:** Equivalent if they represent the same amount of time when converted to a canonical base unit (seconds).
*   **Serialization Representation:**
    ```json
    {
      "value": 240,
      "unit": "SECONDS"
    }
    ```

### 4. ETA
An Estimated Time of Arrival, combining a duration estimate with a dynamic timestamp.
*   **Logical Structure:** A compound structure containing:
    *   `estimatedDuration`: Duration value object.
    *   `targetTime`: UTC Date-Time string representing the expected arrival.
*   **Validation Constraints:**
    *   `estimatedDuration` must be valid.
    *   `targetTime` must conform to ISO 8601 extended format (`YYYY-MM-DDTHH:mm:ss.sssZ`).
*   **Equivalence Rules:** Equivalent if their durations and target times are identical.
*   **Serialization Representation:**
    ```json
    {
      "estimatedDuration": { "value": 300, "unit": "SECONDS" },
      "targetTime": "2026-06-11T13:15:00.000Z"
    }
    ```

### 5. Radius
A search boundary defining a maximum radius.
*   **Logical Structure:** A compound structure containing:
    *   `value`: Floating-point number.
    *   `unit`: One of `METERS`, `KILOMETERS`.
*   **Validation Constraints:**
    *   `value` must be greater than $0.0$ and less than or equal to $100000.0$ (100km).
*   **Equivalence Rules:** Equivalent when values are equal under standard base conversion (meters).
*   **Serialization Representation:**
    ```json
    {
      "value": 5000.0,
      "unit": "METERS"
    }
    ```

### 6. VehicleType
The classification criteria for vehicles.
*   **Logical Structure:** Single-value string code.
*   **Validation Constraints:**
    *   Must be a non-empty string.
    *   Allowed characters: Uppercase alphanumeric and underscores (`^[A-Z0-9_]{1,30}$`).
    *   Standard presets: `SEDAN`, `SUV`, `MOTORCYCLE`, `BICYCLE`, `CARGO_VAN`, `TRUCK`.
*   **Equivalence Rules:** Case-sensitive string matching.
*   **Serialization Representation:** `"SUV"`

### 7. ZoneId
A globally unique identifier for geofenced regions.
*   **Logical Structure:** UUIDv4 string.
*   **Validation Constraints:**
    *   Must conform to RFC 4122 UUID format.
*   **Equivalence Rules:** Case-insensitive string matching.
*   **Serialization Representation:** `"e7b57b98-d8f9-41b1-a67b-4efcd5e07662"`

### 8. DriverId
A unique identifier for a driver registry entry.
*   **Logical Structure:** String namespace-prefixed identifier.
*   **Validation Constraints:**
    *   Prefix match format: `drv_[a-zA-Z0-9_-]{1,60}`.
    *   Minimum length: 5 characters, maximum: 64 characters.
*   **Equivalence Rules:** Case-sensitive string matching.
*   **Serialization Representation:** `"drv_driver1029"`

### 9. SessionId
A unique identifier for tracking sessions.
*   **Logical Structure:** String namespace-prefixed identifier.
*   **Validation Constraints:**
    *   Prefix match format: `ses_[a-zA-Z0-9_-]{1,60}`.
    *   Minimum length: 5 characters, maximum: 64 characters.
*   **Equivalence Rules:** Case-sensitive string matching.
*   **Serialization Representation:** `"ses_session9482"`

### 10. TenantId
A unique identifier for tenant separation.
*   **Logical Structure:** String namespace-prefixed identifier.
*   **Validation Constraints:**
    *   Prefix match format: `tnt_[a-zA-Z0-9_-]{1,60}`.
    *   Minimum length: 5 characters, maximum: 64 characters.
*   **Equivalence Rules:** Case-sensitive string matching.
*   **Serialization Representation:** `"tnt_tenant001"`

### 11. Status
Generic operational status configuration wrapped with state details.
*   **Logical Structure:** A compound structure containing:
    *   `code`: A string value matching valid states.
    *   `reason`: A string explaining the state transition.
*   **Validation Constraints:**
    *   `code` must be non-empty, alphanumeric, uppercase, maximum 50 characters.
    *   `reason` must be optional, maximum 255 characters.
*   **Equivalence Rules:** Equivalent if both `code` and `reason` strings are identical.
*   **Serialization Representation:**
    ```json
    {
      "code": "ACTIVE",
      "reason": "Administrative connection initialization"
    }
    ```

---

## Versioning Considerations

### Versioning Policy for Value Objects
*   **Additive Changes:** Adding optional properties to a value object (e.g. adding `altitude` to `Coordinates`) is non-breaking. Clients that do not support the new fields can safely ignore them.
*   **Breaking Changes:** Modifying constraints (e.g. narrowing the max radius of `Radius` from 100km to 50km) or changing structure (e.g. converting `Coordinates` to a GeoJSON Point array `[longitude, latitude]` format) constitutes a breaking change.
*   **Deprecation Rules:** When deprecating a value object attribute, the change must be announced in the system contract API documentation. The field will remain present in payloads but marked as deprecated for at least one minor release cycle before final elimination.
*   **Backward/Forward Compatibility:** Serialization formats must remain stable. Any structural revision must be accompanied by version suffixes in API request headers or content types.
