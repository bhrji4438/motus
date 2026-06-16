# API Reference - @motus/notifications

This document details the classes, configurations, and provider models of the `@motus/notifications` package.

---

## 1. Class: NotificationService

The central dispatcher orchestrating targeting, preferences, and provider deliveries.

```typescript
export class NotificationService {
  constructor(options: NotificationServiceOptions);
  
  public async sendWithTemplate(
    tenantId: string,
    recipientId: string,
    templateId: string,
    context: Record<string, any>
  ): Promise<NotificationResult>;
}
```

### Options Schema

- `providers`: Array of classes implementing `INotificationProvider`.
- `maxRetries`: Maximum retry attempts on delivery failure.
- `rateLimitMs`: Delivery throttle interval.

---

## 2. Providers: INotificationProvider

Classes interfacing with push API gateways.

```typescript
export interface INotificationProvider {
  readonly platform: "ios" | "android" | "onesignal" | "sms";
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
  public register(template: INotificationTemplate): void;
  public render(
    templateId: string,
    context: Record<string, any>
  ): { title: string; body: string };
}
```

---

## 4. Class: TargetingEngine

Tracks push notification device tokens.

```typescript
export class TargetingEngine {
  public async registerToken(
    tenantId: string,
    recipientId: string,
    token: string,
    platform: "ios" | "android" | "onesignal"
  ): Promise<void>;
  
  public async getTokens(
    tenantId: string,
    recipientId: string
  ): Promise<{ token: string; platform: string }[]>;
}
```
