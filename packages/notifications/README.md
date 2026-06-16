# @motus/notifications

Unified push notifications and templates dispatcher for the Motus platform.

---

## 1. Purpose

Translates platform matching and wave events into push notifications targeted to driver and customer device tokens.

---

## 2. Installation

```bash
npm install @motus/notifications
```

---

## 3. Quick Start

```typescript
import { NotificationService } from "@motus/notifications";

const notificationService = new NotificationService({
  providers: [fcmProvider, apnsProvider],
  preferenceStore: new InMemoryPreferenceStore(),
  deliveryTracker: new InMemoryDeliveryTracker(),
});
```

---

## 4. Configuration

Supports provider integrations (APNs, FCM, OneSignal). Options are passed into `NotificationServiceOptions` structures at initialization.

---

## 5. Common Use Cases

- Registering mobile client tokens.
- Enforcing push preference opt-ins.
- Formatting push templates.
- Scheduling delayed alert jobs.

---

## 6. API Reference Link

- [API Reference: @motus/notifications](../../docs/api-reference/notifications.md)

---

## 7. Related Modules

- `@motus/core` — Domain event listener hooks.
- `@motus/types` — Notification config schemas.

---

## 8. Production Notes

Inject push credentials (APNs certs, FCM keys) securely using environment configurations; never hardcode credentials in code.

---

## 9. Limitations

Push deliveries are subject to mobile platform latency and network speed. Ensure delivery alerts are non-blocking within the main dispatch thread.

---

## 10. Examples

Detailed registration and template setups can be found in the [Notifications Module Page](../../docs/modules/notifications.md).
