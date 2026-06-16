# Room Strategy Guide

Rooms organize socket connection scope and facilitate target broadcasting without excessive routing processing.

## Room Namespaces & Naming Strategy

The `@motus/socketio` gateway structures and restricts room memberships using strict formatting rules.

| Room Pattern | Description | Members |
| :--- | :--- | :--- |
| `tenant:{tenantId}` | Tenant-wide broadcast stream. | All authenticated drivers, consoles, and API agents belonging to a specific tenant. |
| `driver:{driverId}` | Unicast address for a driver. | Sockets representing the driver's active devices (supporting multi-device login). |
| `session:{sessionId}` | Session state listener room. | Consumers and dispatchers tracking session progress (e.g. searching, assigned). |
| `tracking:{sessionId}` | Telemetry/high-frequency updates room. | Consumers tracking live driver coordinates (location streaming). |

---

## Room Lifecycle and Cleanups

To ensure optimal memory management, room lifecycles are completely reactive:

### 1. Tenant Rooms
- **Created**: Dynamically when the first socket for `tenantId` successfully completes the handshake.
- **Destroyed**: Socket.IO automatically deletes the room when the last active socket for that tenant disconnects.

### 2. Driver Rooms
- **Created**: Dynamically when a driver socket authenticates.
- **Destroyed**: When the driver's last active connection disconnects (multi-device cleanup).

### 3. Session & Tracking Rooms
- **Created**: Client explicitly emits a `session:subscribe` or `tracking:subscribe` packet.
- **Destroyed**: Sockets leave when they emit `session:unsubscribe` or when they disconnect.

---

## Cleanup Safety

- Sockets are automatically removed from all rooms by Socket.IO upon transport disconnection.
- The `SubscriptionManager` cleans up in-memory mappings on `disconnect` events to avoid memory leaks.
