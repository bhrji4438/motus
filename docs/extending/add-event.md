# How to Add a New Event

This guide describes how to define new domain events, enforce contract versions, write validators, and register consumers.

---

## Step 1: Define Event Type and Payload

Under `@motus/types`, add the new event definitions in `packages/types/src/events/events.ts`:

1.  **Define Payload Interface**:
    ```typescript
    export interface DriverBatteryLowPayload {
      driverId: string;
      batteryPercentage: number;
    }
    ```
2.  **Add to `MotusEvent` Union**:
    ```typescript
    export type MotusEvent =
      | ...
      | {
          readonly eventId: string;
          readonly eventName: 'driver.battery.low';
          readonly timestamp: string;
          readonly payload: DriverBatteryLowPayload;
        };
    ```

---

## Step 2: Configure Governance & Schema Validators

To ensure payload integrity, register schema rules inside `@motus/core` or `@motus/redis` event governance files.

Add validation rules in `EventGovernanceValidator` or `EventValidator`:

```typescript
// packages/core/src/internal/events/EventValidator.ts
export class EventValidator {
  public validate(event: any): void {
    if (event.eventName === "driver.battery.low") {
      if (typeof event.payload.driverId !== "string") {
        throw new Error("driverId must be a string");
      }
      if (typeof event.payload.batteryPercentage !== "number") {
        throw new Error("batteryPercentage must be a number");
      }
    }
  }
}
```

---

## Step 3: Emit the Event

Emit the event using the `EventDispatcher` inside your managers:

```typescript
import { EventDispatcher } from "@motus/core";

const dispatcher = new EventDispatcher();

await dispatcher.dispatch({
  eventId: generateUuid(),
  eventName: "driver.battery.low",
  timestamp: new Date().toISOString(),
  payload: {
    driverId: "driver-123",
    batteryPercentage: 15,
  },
});
```

---

## Step 4: Register Event Listeners

Subscribers can listen to the event using the public `Vectro` facade client:

```typescript
vectro.events.on("driver.battery.low", (event) => {
  console.log(
    `Driver ${event.payload.driverId} has low battery: ${event.payload.batteryPercentage}%`
  );
});
```

Your new event is now integrated into the platform's outbox and event dispatcher pipelines!
