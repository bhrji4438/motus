import {
  NotificationService,
  FcmProvider,
  ApnsProvider,
  OneSignalProvider,
} from '@motus/notifications';

async function main() {
  // 1. Initialize notification providers with mock mode active
  const fcm = new FcmProvider({ useMock: true });
  const apns = new ApnsProvider({ useMock: true });
  const oneSignal = new OneSignalProvider({ useMock: true });

  const notificationService = new NotificationService({
    providers: [fcm, apns, oneSignal],
    maxRetries: 3,
    rateLimitMs: 500, // 500ms recipient threshold
  });

  console.log('Notification Engine Online');

  // 2. Register a default matching template
  notificationService.getTemplates().register({
    id: 'session_matching',
    titleTemplate: 'New Dispatch Offer',
    bodyTemplate: 'Hi {{driverName}}, session {{sessionId}} is open for grabs near {{pickup}}!',
  });

  // 3. Register device tokens for driver recipients
  const targeting = notificationService.getTargetingEngine();
  await targeting.registerToken('T1', 'driver-101', 'ios-device-token-abc', 'ios');
  await targeting.registerToken('T1', 'driver-102', 'android-device-token-xyz', 'android');

  // 4. Send alert with template (iOS platform routes automatically to APNS)
  const resultApns = await notificationService.sendWithTemplate(
    'T1',
    'driver-101',
    'session_matching',
    { driverName: 'John', sessionId: 'S500', pickup: 'Downtown SF' }
  );
  console.log(`Driver 101 alert status: ${resultApns.success ? 'Delivered' : 'Failed'} via ${resultApns.providerName}`);

  // 5. Send alert with template (Android platform routes automatically to FCM)
  const resultFcm = await notificationService.sendWithTemplate(
    'T1',
    'driver-102',
    'session_matching',
    { driverName: 'Sarah', sessionId: 'S500', pickup: 'Downtown SF' }
  );
  console.log(`Driver 102 alert status: ${resultFcm.success ? 'Delivered' : 'Failed'} via ${resultFcm.providerName}`);

  // 6. Schedule a reminder notification for 5 seconds from now
  const sendTime = new Date(Date.now() + 5000);
  const jobId = await notificationService.schedule(
    'T1',
    'driver-101',
    'Still available?',
    'Are you accepting the S500 dispatch request?',
    sendTime,
    'idemp-key-reminder-500'
  );
  console.log(`Notification reminder scheduled. Job ID: ${jobId}`);

  // 7. Manually process scheduled deliveries (simulating scheduler loop ticker)
  setTimeout(async () => {
    const processed = await notificationService.getScheduler().processPendingJobs(async (tenant, payload) => {
      console.log(`Scheduler dispatched alert: ${payload.title} to recipient ${payload.recipientId}`);
    });
    console.log(`Processed ${processed} scheduled reminders.`);
  }, 6000);
}

main().catch(err => {
  console.error('Error running notification demo:', err);
});
