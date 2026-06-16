# How to Add a New Notification Provider

This guide describes how to implement a custom push or SMS provider by implementing the `INotificationProvider` interface.

---

## Step 1: Create the Provider Class

Create a new file in `packages/notifications/src/providers/` (e.g. `TwilioProvider.ts`). Implement the `INotificationProvider` interface exported by `@motus/notifications`.

```typescript
import {
  INotificationProvider,
  NotificationPayload,
  NotificationResult,
  ProviderCapabilities,
} from "@/providers/INotificationProvider.js";

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

export class TwilioProvider implements INotificationProvider {
  public readonly platform = "sms" as any; // Custom platform target

  constructor(private readonly config: TwilioConfig) {}

  public getCapabilities(): ProviderCapabilities {
    return {
      supportsDataPayloads: false,
      supportsSound: false,
    };
  }

  public async send(
    phoneNumber: string,
    payload: NotificationPayload
  ): Promise<NotificationResult> {
    try {
      // Execute Twilio API call here
      const success = await this.twilioApiCall(phoneNumber, payload.body);

      return {
        success: true,
        messageId: "twilio-msg-id-123",
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async twilioApiCall(to: string, body: string): Promise<boolean> {
    // API calling logic here
    return true;
  }
}
```

---

## Step 2: Export from Package Index

Expose the new provider and its config interface in `packages/notifications/src/index.ts`:

```typescript
export { TwilioProvider, TwilioConfig } from "@/providers/TwilioProvider.js";
```

---

## Step 3: Register in Notification Service

During application bootstrap, instantiate the provider and pass it to the `NotificationService`:

```typescript
import { NotificationService } from "@motus/notifications";
import { TwilioProvider } from "@motus/notifications";

const smsProvider = new TwilioProvider({
  accountSid: process.env.TWILIO_SID!,
  authToken: process.env.TWILIO_TOKEN!,
  fromNumber: process.env.TWILIO_FROM!,
});

const notificationService = new NotificationService({
  providers: [smsProvider],
  preferenceStore: new InMemoryPreferenceStore(),
  deliveryTracker: new InMemoryDeliveryTracker(),
});
```

Your custom provider is now fully integrated into the notifications pipeline!
