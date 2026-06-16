# SDK Surface Review

## Current State
The client SDK outline in `12-sdk-design.md` specifies base APIs for registering tenants/drivers and creating/cancelling sessions. However, it lacks methods representing a complete real-time dispatch engine, such as driver presence controls, manual reassignment overrides, and client-side tracking listeners.

---

## Findings
1.  **Driver Presence Controls:** While `registerDriver` exists, driver status flows require the ability to pause and resume active shifts. Without explicit `pauseDriver` and `resumeDriver` APIs, consumer apps must directly modify status fields in the database.
2.  **Tracking Observers:** Consuming applications need a simple way to listen to live coordinate frames for active sessions. Requiring developers to implement raw Socket.io room joins manually is error-prone.
3.  **Manual Reassignments:** If a driver is lost or a dispatcher overrides a match, the engine must support manually triggering a session reassignment.

---

## Risks
*   **Encapsulation Leaks:** Developers will build ad-hoc Redis client scripts to modify driver statuses or join socket rooms if these APIs are missing, breaking the package boundaries of `@motus/redis` and `@motus/socketio`.
*   **Integration Friction:** Lack of a standard location-tracking subscription mechanism will increase the integration time for consumer applications.

---

## Recommended Changes

We recommend adding the following methods to the public `MotusClient` SDK API:

### A. Driver Presence API Extensions
```typescript
/**
 * Temporarily pause driver from receiving new dispatch matching waves.
 * Transitions presence status to PAUSED.
 */
pauseDriver(tenantId: string, driverId: string): Promise<DriverPresence>;

/**
 * Resume driver presence status back to ONLINE.
 */
resumeDriver(tenantId: string, driverId: string): Promise<DriverPresence>;

/**
 * Retrieve current presence status, current load, and capacity limits.
 */
getDriverPresence(tenantId: string, driverId: string): Promise<DriverPresence>;
```

### B. Session Control Extensions
```typescript
/**
 * Forcefully detach the currently assigned driver from the session,
 * decrement their load counter, and transition the session back to SEARCHING
 * to trigger a fresh dispatch wave.
 */
reassignSession(tenantId: string, sessionId: string): Promise<Session>;
```

### C. Live Tracking Subscription API
```typescript
/**
 * Programmatically subscribe to real-time telemetry coordinates for a session.
 * Encapsulates the Socket.io connection handshake and room join logic.
 */
subscribeSessionTracking(
  tenantId: string,
  sessionId: string,
  onCoordinate: (location: LocationCoordinate) => void,
  onError?: (error: Error) => void
): Promise<TrackingSubscription>;

interface TrackingSubscription {
  subscriptionId: string;
  unsubscribe(): Promise<void>;
}
```

---

## Final Decision
Approve the addition of these presence controls, reassignment overrides, and subscription listeners to the official V1 SDK client interface.

---

## Impact Analysis
*   **Developer Experience (DX):** Simplifies application integration by hiding Socket.io connection handshakes behind a single client-side subscription method.
*   **Security:** Enforces authorization validation at the SDK client boundary before establishing socket subscription rooms.
