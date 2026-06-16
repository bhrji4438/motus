// Provider exports
export {
  INotificationProvider,
  NotificationPayload,
  NotificationResult,
  ProviderCapabilities,
} from "@/providers/INotificationProvider.js";
export { FcmProvider, FcmConfig } from "@/providers/FcmProvider.js";
export { ApnsProvider, ApnsConfig } from "@/providers/ApnsProvider.js";
export {
  OneSignalProvider,
  OneSignalConfig,
} from "@/providers/OneSignalProvider.js";

// Subsystems exports
export {
  TemplateManager,
  INotificationTemplate,
} from "@/templates/TemplateManager.js";
export {
  INotificationPreferenceStore,
  InMemoryPreferenceStore,
  UserPreferences,
} from "@/preferences/PreferenceStore.js";
export { TargetingEngine, DeviceToken } from "@/targeting/TargetingEngine.js";
export {
  IDeliveryTracker,
  InMemoryDeliveryTracker,
  DeliveryReceipt,
} from "@/delivery/DeliveryTracker.js";
export {
  INotificationScheduler,
  InMemoryNotificationScheduler,
  ScheduledJob,
} from "@/scheduling/NotificationScheduler.js";
export { EventNotificationBridge } from "@/events/EventNotificationBridge.js";

// Central Service exports
export {
  NotificationService,
  NotificationServiceOptions,
} from "@/services/NotificationService.js";
