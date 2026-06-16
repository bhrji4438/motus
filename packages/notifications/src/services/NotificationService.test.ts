import { describe, it, expect } from "vitest";
import { NotificationService } from "@/services/NotificationService.js";
import { FcmProvider } from "@/providers/FcmProvider.js";
import { ApnsProvider } from "@/providers/ApnsProvider.js";
import { TargetingEngine } from "@/targeting/TargetingEngine.js";

describe("NotificationService", () => {
  it("should compile templates and send push alerts successfully", async () => {
    const fcm = new FcmProvider({ useMock: true });
    const apns = new ApnsProvider({ useMock: true });
    const targeting = new TargetingEngine();

    // Register tokens for recipient
    await targeting.registerToken("T1", "driver-1", "token-ios-123", "ios");

    const service = new NotificationService({
      providers: [fcm, apns],
      targetingEngine: targeting,
      rateLimitMs: 0, // Disable rate limit for test
    });

    service.getTemplates().register({
      id: "session_assigned",
      titleTemplate: "New Session Assigned",
      bodyTemplate: "Session {{sessionId}} is assigned to you",
    });

    const result = await service.sendWithTemplate(
      "T1",
      "driver-1",
      "session_assigned",
      { sessionId: "S100" }
    );

    expect(result.success).toBe(true);
    expect(result.providerName).toBe("apns"); // IOS device triggers APNS routing first
    expect(result.messageId).toBeDefined();
  });

  it("should failover to fallback provider if primary is DOWN", async () => {
    const brokenApns = new ApnsProvider({ useMock: false }); // Will fail healthcheck/sending due to missing keys
    const fcm = new FcmProvider({ useMock: true });
    const targeting = new TargetingEngine();

    await targeting.registerToken("T1", "driver-1", "token-ios-123", "ios");

    const service = new NotificationService({
      providers: [brokenApns, fcm],
      targetingEngine: targeting,
      rateLimitMs: 0,
    });

    const result = await service.send("T1", "driver-1", "Hello", "World");
    expect(result.success).toBe(true);
    expect(result.providerName).toBe("fcm"); // APNS is DOWN, fails over to FCM
  });

  it("should block sending when user preference opts-out of notifications", async () => {
    const fcm = new FcmProvider({ useMock: true });
    const targeting = new TargetingEngine();
    await targeting.registerToken("T1", "driver-1", "token-123", "android");

    const service = new NotificationService({
      providers: [fcm],
      targetingEngine: targeting,
      rateLimitMs: 0,
    });

    // Opt out driver from push
    await service.send("T1", "driver-1", "Title", "Body"); // first check before opt out
    const optOutStore = (service as any).preferenceStore;
    await optOutStore.setPreferences("driver-1", {
      userId: "driver-1",
      disabledChannels: ["push"],
      optedOutTopics: [],
    });

    const result = await service.send("T1", "driver-1", "Title", "Body");
    expect(result.success).toBe(false);
    expect(result.error).toContain("User preference opted-out");
  });
});
