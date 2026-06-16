# @motus/notifications

Unified and extensible notifications platform framework for Motus. Supports Firebase Cloud Messaging (FCM), Apple Push Notification Service (APNS), OneSignal, and modular custom notification integrations.

## Features

- **Provider Abstraction Layer**: Unified interface for APNS, FCM, and OneSignal, featuring capability mapping (`platforms`, `supportsTopics`, `supportsBulk`) and prioritizing options.
- **Failover Routing Policy**: Smart routing matches platform contexts (e.g. iOS targets route first to APNS, Android to FCM) and transparently falls back to secondary networks.
- **Deduplicated Scheduling**: Schedule future notifications with restart-recovery queues and idempotency guards to prevent duplicate sends.
- **Preferences Checking**: User-level preference store checking opt-out configurations per communication channel and topic.
- **Targeting Engine**: Maps user/driver identity keys to active device tokens and prunes stale/invalid tokens automatically on repeat errors.
- **Reliable Retries**: Delivery attempts utilize exponential backoff delays with custom limits.
- **Event-Driven Dispatch**: Bridge mapping core MotusEvents (such as session assigned) to template pushes automatically.

## Usage

### Setup and Dispatch
```typescript
import { NotificationService, FcmProvider, ApnsProvider } from '@motus/notifications';

const service = new NotificationService({
  providers: [
    new FcmProvider({ projectId: '...', clientEmail: '...', privateKey: '...' }),
    new ApnsProvider({ teamId: '...', keyId: '...', key: '...', bundleId: '...' })
  ],
  maxRetries: 3
});

// Register templates
service.getTemplates().register({
  id: 'dispatch_wave',
  titleTemplate: 'New Offer!',
  bodyTemplate: 'Hi {{name}}, you have a new dispatch offer.'
});

// Map recipient device token
await service.getTargetingEngine().registerToken('tenant-1', 'driver-1', 'device-token-xyz', 'ios');

// Send template push
await service.sendWithTemplate('tenant-1', 'driver-1', 'dispatch_wave', { name: 'John' });
```
