import {
  NotificationService,
  FcmProvider,
  ApnsProvider,
  OneSignalProvider,
} from "@motus/notifications";

async function main() {
  console.log("Starting Vectro Notifications Integration Demo...");

  // 1. Initialize notification providers with mock mode active
  // In production, inject credentials via configuration block or environment variables.
  const fcm = new FcmProvider({ useMock: true });
  const apns = new ApnsProvider({ useMock: true });
  const oneSignal = new OneSignalProvider({ useMock: true });

  const notificationService = new NotificationService({
    providers: [fcm, apns, oneSignal],
    maxRetries: 3,
    rateLimitMs: 500, // Enforces 500ms recipient threshold
  });

  console.log("Vectro Notification Service Online!");

  // 2. Register a default matching template
  notificationService.getTemplates().register({
    id: "new_offer_alert",
    titleTemplate: "New Dispatch Offer",
    bodyTemplate: "Hi {{driverName}}, order {{sessionId}} is available near {{pickup}}! Wave #{{waveNumber}}.",
  });

  const tenantId = "tenant-notification-demo";
  const driverId = "driver-courier-fcm";

  // 3. Register push tokens for driver device mapping
  const targeting = notificationService.getTargetingEngine();
  
  // Registering an Android driver token for FCM delivery
  console.log("Registering device token for FCM targeting...");
  await targeting.registerToken(
    tenantId,
    driverId,
    "fcm-android-device-token-123",
    "android"
  );

  // 4. Simulate dispatch offering and sending notifications inside a wave
  console.log("Simulating wave dispatch notification triggers...");
  
  const result = await notificationService.sendWithTemplate(
    tenantId,
    driverId,
    "new_offer_alert",
    {
      driverName: "Sarah Connor",
      sessionId: "ses_order_999",
      pickup: "Downtown Business Park",
      waveNumber: "1"
    }
  );

  console.log(
    `Notification Dispatch Summary:\n` +
    ` - Success: ${result.success ? "YES" : "NO"}\n` +
    ` - Delivery Channel: ${result.providerName}\n` +
    ` - Recipient: ${driverId}\n` +
    ` - Details: ${JSON.stringify(result.details || {})}`
  );

  // 5. Schedule a reminder push for 2 seconds in the future
  console.log("Scheduling reminder notification...");
  const triggerTime = new Date(Date.now() + 2000);
  const jobId = await notificationService.schedule(
    tenantId,
    driverId,
    "Urgent Offer Reminder",
    "Are you accepting the S999 dispatch request? Offer expires in 5 seconds.",
    triggerTime,
    "idemp-reminder-999"
  );
  console.log(`Reminder scheduled. Job ID: ${jobId}`);

  // Simulating the background scheduler worker process
  console.log("Waiting to process pending jobs...");
  await new Promise((resolve) => setTimeout(resolve, 2500));

  const processed = await notificationService
    .getScheduler()
    .processPendingJobs(async (tenant, payload) => {
      console.log(`[Scheduler Triggered] Sent pushing alert: "${payload.title}" to ${payload.recipientId}`);
    });
  
  console.log(`Processed ${processed} pending reminders.`);
}

main().catch(console.error);
