# Gateway Event Schema Guide

This guide details all WebSocket event names, payload contracts, and error structures supported by the `@motus/socketio` gateway layer.

## Inbound Events (Client to Server)

### `driver:presence`
Sent by drivers to set or update their online availability state.
- **Payload Schema**:
  ```json
  {
    "status": "ONLINE" | "OFFLINE" | "PAUSED",
    "capacity": 10
  }
  ```

### `driver:location`
High-frequency coordinate streaming sent by driver devices.
- **Payload Schema**:
  ```json
  {
    "location": {
      "latitude": 37.7749,
      "longitude": -122.4194
    },
    "speed": 12.5,
    "bearing": 180,
    "timestamp": "2026-06-15T12:00:00.000Z"
  }
  ```

### `assignment:accept`
Driver acceptance of a candidate offer wave.
- **Payload Schema**:
  ```json
  {
    "sessionId": "ses_abc123",
    "waveNumber": 1
  }
  ```

### `assignment:reject`
Driver rejection of a candidate offer wave.
- **Payload Schema**:
  ```json
  {
    "sessionId": "ses_abc123",
    "waveNumber": 1
  }
  ```

### `session:subscribe`
Join session state updates.
- **Payload Schema**:
  ```json
  {
    "sessionId": "ses_abc123"
  }
  ```

### `tracking:subscribe`
Join high-frequency telemetry updates.
- **Payload Schema**:
  ```json
  {
    "sessionId": "ses_abc123"
  }
  ```

---

## Outbound Events (Server to Client)

### `assignment:offer`
Sent to candidates inside active waves.
- **Payload Schema**:
  ```json
  {
    "sessionId": "ses_abc123",
    "waveNumber": 1,
    "expiresAt": "2026-06-15T12:05:00.000Z"
  }
  ```

### `session:<state>`
Emitted to clients in the room `session:{sessionId}` on lifecycle changes (e.g. `session:assigned`).
- **Payload Schema**:
  ```json
  {
    "tenantId": "tnt_abc",
    "sessionId": "ses_abc123",
    "assignedDriverId": "drv_xyz789",
    "estimatedDurationSeconds": 600
  }
  ```

### `tracking:update`
Throttled coordinate frames sent to room `tracking:{sessionId}`.
- **Payload Schema**:
  ```json
  {
    "location": {
      "latitude": 37.7752,
      "longitude": -122.4198
    },
    "speed": 14.2,
    "bearing": 185,
    "timestamp": "2026-06-15T12:00:05.000Z"
  }
  ```

---

## Error Payloads

All pipeline validation and permission check errors return a standardized `MotusError` structure over the `error` event:

```json
{
  "code": "MOTUS_UNAUTHORIZED" | "MOTUS_INVALID_ARGUMENT" | "MOTUS_INTERNAL_ERROR",
  "message": "Human-readable explanation of error condition",
  "timestamp": "2026-06-15T12:00:00.000Z",
  "cause": "Underlying error context if available",
  "details": {}
}
```
