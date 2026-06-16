import { describe, it, expect } from "vitest";
import { SubscriptionManager } from "@/managers/SubscriptionManager.js";
import { MetricsManager } from "@/observability/MetricsManager.js";

describe("SubscriptionManager", () => {
  const metricsManager = new MetricsManager();

  it("subscribes socket and protects against duplicates", () => {
    const subManager = new SubscriptionManager(metricsManager);

    const added1 = subManager.subscribe("socket_1", "session:s1", 5);
    expect(added1).toBe(true);
    expect(subManager.hasSubscription("socket_1", "session:s1")).toBe(true);

    const added2 = subManager.subscribe("socket_1", "session:s1", 5);
    expect(added2).toBe(false); // Duplicate check
  });

  it("enforces subscription limits", () => {
    const subManager = new SubscriptionManager(metricsManager);

    subManager.subscribe("socket_1", "session:s1", 2);
    subManager.subscribe("socket_1", "session:s2", 2);

    expect(() => {
      subManager.subscribe("socket_1", "session:s3", 2);
    }).toThrow(/limit exceeded/);
  });

  it("unsubscribes and cleans up correctly", () => {
    const subManager = new SubscriptionManager(metricsManager);

    subManager.subscribe("socket_1", "session:s1", 5);
    subManager.subscribe("socket_1", "session:s2", 5);

    const removed = subManager.unsubscribe("socket_1", "session:s1");
    expect(removed).toBe(true);
    expect(subManager.getSubscriptions("socket_1")).toEqual(["session:s2"]);

    subManager.cleanup("socket_1");
    expect(subManager.getSubscriptions("socket_1")).toEqual([]);
  });
});
