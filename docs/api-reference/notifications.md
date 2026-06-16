# API Reference - @motus/notifications

This document details the classes, configurations, and provider models of the `@motus/notifications` package.

---

## 1. Class: NotificationService

The central dispatcher orchestrating targeting, preferences, and provider deliveries.

```typescript
export class NotificationService {
  constructor(options: NotificationServiceOptions);
  public async sendNotification(
    userId: string,
    templateId: string,
    context: Record<string, any>
  ): Promise<NotificationResult>;
}
```

### Options Schema

- `providers`: Array of classes implementing `INotificationProvider`.
- `preferenceStore`: `INotificationPreferenceStore` implementation.
- `deliveryTracker`: `IDeliveryTracker` implementation.

---

## 2. Providers: INotificationProvider

Classes interfacing with push API gateways.

```typescript
export interface INotificationProvider {
  readonly platform: "apns" | "fcm" | "onesignal";
  send(
    token: string,
    payload: NotificationPayload
  ): Promise<NotificationResult>;
}
```

### Implementations:

- **`FcmProvider`**: Firebase Cloud Messaging.
- **`ApnsProvider`**: Apple Push Notification service.
- **`OneSignalProvider`**: OneSignal Push notifications.

---

## 3. Class: TemplateManager

Handles notification message rendering.

```typescript
export class TemplateManager {
  public registerTemplate(template: INotificationTemplate): void;
  public render(
    templateId: string,
    context: Record<string, any>
  ): NotificationPayload;
}
```

---

## 4. Class: UserPreferences (Preference Store)

Checks opt-in state before triggering messages.

```typescript
export interface INotificationPreferenceStore {
  getPreferences(userId: string): Promise<UserPreferences>;
  savePreferences(userId: string, prefs: UserPreferences): Promise<void>;
}
```

- `InMemoryPreferenceStore`: Fallback implementation.
