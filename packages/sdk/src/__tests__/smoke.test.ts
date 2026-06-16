import { describe, it, expect, vi, beforeEach } from "vitest";
import { createVectro } from "../factory.js";
import { MatchingStrategy } from "@motus/types";

// Mock ioredis to prevent actual network calls during testing
vi.mock("ioredis", () => {
  const mockPipeline = {
    hset: vi.fn().mockReturnThis(),
    geoadd: vi.fn().mockReturnThis(),
    zadd: vi.fn().mockReturnThis(),
    hgetall: vi.fn().mockReturnThis(),
    xrange: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([
      [null, {}],
      [null, []],
      [null, []],
    ]),
  };

  const mockRedisInstance = {
    status: "ready",
    once: vi.fn((event, callback) => {
      if (event === "ready") callback();
    }),
    on: vi.fn(),
    quit: vi.fn().mockResolvedValue("OK"),
    hset: vi.fn().mockResolvedValue(1),
    hgetall: vi.fn().mockImplementation((key: string) => {
      if (key.includes("driver:drv_test")) {
        return {
          id: "drv_test",
          tenantId: "tnt_test",
          status: "OFFLINE",
          capacity: "2",
          currentLoad: "0",
          vehicleType: "SEDAN",
          lastHeartbeat: "2026-06-11T14:00:00Z",
          latitude: "0",
          longitude: "0",
          locationTimestamp: "2026-06-11T14:00:00Z",
        };
      }
      if (key.includes("tenant:tnt_test")) {
        return {
          id: "tnt_test",
          name: "Test Tenant",
          "matchingConfig.strategy": "DISTANCE",
          "matchingConfig.maxSearchRadius.value": "5000",
          "matchingConfig.maxSearchRadius.unit": "METERS",
          "matchingConfig.maxCandidatesPerWave": "5",
          "fanoutConfig.mode": "PARALLEL",
          "fanoutConfig.intervalSeconds": "5",
          "retryPolicy.maxWaves": "5",
          "retryPolicy.waveTimeoutSeconds": "10",
          "retryPolicy.reEvaluationDelaySeconds": "10",
          zones: "[]",
        };
      }
      return {};
    }),
    georadius: vi.fn().mockResolvedValue([]),
    zadd: vi.fn().mockResolvedValue(1),
    zrem: vi.fn().mockResolvedValue(1),
    zrangebyscore: vi.fn().mockResolvedValue([]),
    scan: vi.fn().mockResolvedValue(["0", []]),
    ttl: vi.fn().mockResolvedValue(100),
    del: vi.fn().mockResolvedValue(1),
    subscribe: vi.fn().mockResolvedValue("OK"),
    psubscribe: vi.fn().mockResolvedValue("OK"),
    unsubscribe: vi.fn().mockResolvedValue("OK"),
    publish: vi.fn().mockResolvedValue(1),
    pipeline: vi.fn().mockReturnValue(mockPipeline),
    motusSaveDriverAtomic: vi.fn().mockResolvedValue("OK"),
    defineCommand: vi.fn(),
  };

  return {
    Redis: vi.fn().mockImplementation(() => mockRedisInstance),
    Cluster: vi.fn().mockImplementation(() => mockRedisInstance),
    default: vi.fn().mockImplementation(() => mockRedisInstance),
  };
});

describe("Vectro Public SDK Smoke Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize VectroInstance with all namespaces and stop correctly", async () => {
    const vectro = await createVectro({
      redis: {
        host: "localhost",
        port: 6379,
      },
    });

    expect(vectro.tenant).toBeDefined();
    expect(vectro.driver).toBeDefined();
    expect(vectro.session).toBeDefined();
    expect(vectro.query).toBeDefined();
    expect(vectro.events).toBeDefined();

    // Verify operations are defined and function (using our mocked redis)
    await expect(
      vectro.tenant.registerTenant({
        tenantId: "tnt_test",
        name: "Test Tenant",
        matchingStrategy: MatchingStrategy.DISTANCE,
        idempotencyKey: "t1",
      })
    ).resolves.toBeDefined();

    await expect(
      vectro.driver.registerDriver({
        tenantId: "tnt_test",
        driverId: "drv_test",
        capacity: 2,
        vehicleType: "SEDAN",
        idempotencyKey: "d1",
      })
    ).resolves.toBeDefined();

    await expect(
      vectro.driver.setDriverOnline("tnt_test", "drv_test")
    ).resolves.not.toThrow();

    await expect(vectro.stop()).resolves.not.toThrow();
  });

  it("should bootstrap with environment variables when no configuration is passed", async () => {
    process.env.REDIS_HOST = "127.0.0.1";
    process.env.REDIS_PORT = "6380";

    const vectro = await createVectro();
    expect(vectro).toBeDefined();

    await expect(vectro.stop()).resolves.not.toThrow();

    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
  });
});
