# 35 - Error Model

This document establishes the system-wide error model for the Motus platform. It defines standard error properties, retry guidelines, and mapping schemas for HTTP and WebSocket communication layers.

---

## Error Structure Specification

All error responses returned by the Motus server API or thrown by the SDK must conform to a standardized, platform-independent structure.

```json
{
  "code": "MOTUS_INVALID_TRANSITION",
  "message": "Cannot transition session from CREATED to COMPLETED.",
  "cause": "Sessions must pass through SEARCHING, DRIVER_ASSIGNED, and IN_PROGRESS states before completion.",
  "timestamp": "2026-06-11T13:12:00.000Z",
  "details": {
    "sessionId": "ses_trip2841",
    "currentState": "CREATED",
    "targetState": "COMPLETED"
  }
}
```

---

## Canonical Error Codes

### 1. MOTUS_DRIVER_NOT_FOUND
*   **Logical Message:** "The requested driver could not be located."
*   **Standard Cause:** The driver ID does not exist within the specified tenant partition in the database.
*   **Retryability:** Not Retryable. Resolving requires verifying the driver registration.
*   **HTTP Mapping:** `404 Not Found`
*   **WebSocket Code:** `4404`

### 2. MOTUS_SESSION_NOT_FOUND
*   **Logical Message:** "The requested dispatch session could not be located."
*   **Standard Cause:** The session ID is not active or has been purged from memory caches.
*   **Retryability:** Not Retryable.
*   **HTTP Mapping:** `404 Not Found`
*   **WebSocket Code:** `4405`

### 3. MOTUS_INVALID_TRANSITION
*   **Logical Message:** "Invalid state transition requested."
*   **Standard Cause:** The resource state machine rejected the transition from its current state to the requested state.
*   **Retryability:** Not Retryable. Indicates a sequence error on the client.
*   **HTTP Mapping:** `422 Unprocessable Entity`
*   **WebSocket Code:** `4422`

### 4. MOTUS_DRIVER_BUSY
*   **Logical Message:** "The driver is at maximum capacity load and cannot accept assignments."
*   **Standard Cause:** The driver's active assignments count matches or exceeds their configured capacity.
*   **Retryability:** Retryable. The client can retry after a cooling delay, or when the driver completes other jobs.
*   **HTTP Mapping:** `409 Conflict`
*   **WebSocket Code:** `4409`

### 5. MOTUS_CAPACITY_EXCEEDED
*   **Logical Message:** "Tenant operational limits exceeded."
*   **Standard Cause:** The number of active sessions or drivers exceeds the tenant's license or operational capacity threshold.
*   **Retryability:** Retryable with Backoff. Indicates high system load.
*   **HTTP Mapping:** `429 Too Many Requests`
*   **WebSocket Code:** `4429`

### 6. MOTUS_INVALID_VEHICLE_TYPE
*   **Logical Message:** "Vehicle type mismatch."
*   **Standard Cause:** The driver's registered vehicle classification does not satisfy the session requirements.
*   **Retryability:** Not Retryable.
*   **HTTP Mapping:** `400 Bad Request`
*   **WebSocket Code:** `4400`

### 7. MOTUS_LOCK_ACQUISITION_FAILED
*   **Logical Message:** "Unable to acquire resource lock."
*   **Standard Cause:** Another concurrent process is currently modifying the target resource (driver or session), or a duplicate idempotency key is in-flight.
*   **Retryability:** Retryable with Jittered Backoff.
*   **HTTP Mapping:** `409 Conflict` (or `423 Locked`)
*   **WebSocket Code:** `4423`

### 8. MOTUS_INVALID_ARGUMENT
*   **Logical Message:** "Input validation checks failed."
*   **Standard Cause:** Coordinate ranges, IDs, or timestamps are formatted incorrectly or contain out-of-range values.
*   **Retryability:** Not Retryable. The request payload must be corrected.
*   **HTTP Mapping:** `400 Bad Request`
*   **WebSocket Code:** `4401`

### 9. MOTUS_UNAUTHORIZED
*   **Logical Message:** "Missing or invalid security credentials."
*   **Standard Cause:** JWT signature verification failed or api key is missing.
*   **Retryability:** Not Retryable (until token or credentials are refreshed).
*   **HTTP Mapping:** `401 Unauthorized`
*   **WebSocket Code:** `4403`

### 10. MOTUS_INTERNAL_ERROR
*   **Logical Message:** "An unexpected system malfunction occurred."
*   **Standard Cause:** Database timeouts, Redis memory exhaustion, or unexpected code execution branches.
*   **Retryability:** Retryable with Exponential Backoff.
*   **HTTP Mapping:** `500 Internal Server Error`
*   **WebSocket Code:** `5000`

---

## Versioning Considerations

### Versioning Policy for Error Model
*   **Additive Changes:** Adding a new error code to the `ErrorCode` enum or adding new optional fields to the `details` metadata map is a non-breaking minor version upgrade.
*   **Breaking Changes:** Deleting an error code, renaming a code (e.g. `MOTUS_DRIVER_NOT_FOUND` to `DRIVER_MISSING`), changing the HTTP status mappings of existing errors, or modifying the type structure of the base error JSON schema constitutes a breaking change.
*   **Deprecation Rules:** When an error code is targeted for replacement, it will be kept in the API contracts for at least one minor release, with warnings in client integration logs when it is returned.
*   **Backward/Forward Compatibility:** Clients must catch generic exceptions if they encounter an unknown code, mapping it to standard retry behaviors based on the HTTP status code.
