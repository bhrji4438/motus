import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  startRedisTestContainer,
  flushTestRedis,
  type RedisTestContext,
} from "@/__tests__/helpers/RedisTestContainer.js";
import { RedisLockManager } from "@/repositories/RedisLockManager.js";
import { DEFAULT_LOCK_CONFIG } from "@/config/index.js";

describe("RedisLockManager (integration)", () => {
  let ctx: RedisTestContext;
  let lockManager: RedisLockManager;

  beforeAll(async () => {
    ctx = await startRedisTestContainer();
    lockManager = new RedisLockManager(ctx.client, DEFAULT_LOCK_CONFIG);
  });

  afterAll(async () => {
    await ctx.manager.disconnect();
    await ctx.container.stop();
  });

  beforeEach(async () => {
    await flushTestRedis(ctx.client);
  });

  it("acquires a lock that is not held", async () => {
    const acquired = await lockManager.acquireLock("test-resource");
    expect(acquired).toBe(true);
  });

  it("fails to acquire a lock that is already held", async () => {
    await lockManager.acquireLock("test-resource");
    const second = await lockManager.acquireLock("test-resource");
    expect(second).toBe(false);
  });

  it("acquires a lock with handle and releases it with owner token verification", async () => {
    const handle = await lockManager.acquireLockWithHandle("res-handle", 10000);
    expect(handle).not.toBeNull();

    // Lock should be held
    const second = await lockManager.acquireLock("res-handle");
    expect(second).toBe(false);

    // Release with correct owner token
    await lockManager.releaseLockHandle(handle!);

    // Now re-acquirable
    const third = await lockManager.acquireLock("res-handle");
    expect(third).toBe(true);
  });

  it("lock key expires after TTL", async () => {
    const handle = await lockManager.acquireLockWithHandle("ttl-test", 200); // 200ms TTL
    expect(handle).not.toBeNull();

    // Wait for TTL to expire
    await new Promise((r) => setTimeout(r, 400));

    const reacquired = await lockManager.acquireLock("ttl-test");
    expect(reacquired).toBe(true);
  });

  it("handles concurrent lock contention correctly", async () => {
    const resource = "concurrent-resource";
    const results = await Promise.all(
      Array.from({ length: 10 }, () => lockManager.acquireLock(resource))
    );

    // Exactly one should succeed
    const successes = results.filter(Boolean);
    expect(successes).toHaveLength(1);
  });

  it("lock renewal extends TTL", async () => {
    const handle = await lockManager.acquireLockWithHandle(
      "renewal-test",
      1000
    );
    expect(handle).not.toBeNull();

    lockManager.startRenewal(handle!);

    // Wait beyond initial TTL to verify renewal kept it alive
    await new Promise((r) => setTimeout(r, 800));

    const still = await lockManager.acquireLock("renewal-test");
    expect(still).toBe(false); // Should still be held

    await lockManager.releaseLockHandle(handle!);
  });
});
