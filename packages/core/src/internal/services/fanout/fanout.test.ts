import { describe, it, expect, vi, beforeEach } from "vitest";
import { MatchingStrategy, DriverStatus, SessionState } from "@motus/types";
import { FanoutEngine } from "@/internal/services/fanout/FanoutEngine.js";
import { AssignmentManager } from "@/internal/managers/AssignmentManager.js";
import { SessionManager } from "@/internal/managers/SessionManager.js";
import { DriverManager } from "@/internal/managers/DriverManager.js";
import { MatchingEngine } from "@/internal/services/matching/MatchingEngine.js";
import { ConfigurationManager } from "@/public/config/ConfigurationManager.js";

describe("Phase 3 Wave Distribution: Fanout & Assignment", () => {
  let tenantRepo: any;
  let driverRepo: any;
  let sessionRepo: any;
  let lockMgr: any;
  let eventBus: any;
  let clock: any;
  let idGen: any;
  let metrics: any;
  let logger: any;
  let configProvider: any;

  beforeEach(() => {
    const tenants = new Map();
    tenantRepo = {
      save: vi.fn(async (t) => {
        tenants.set(t.id, t);
      }),
      get: vi.fn(async (id) => tenants.get(id) || null),
    };

    const drivers = new Map();
    driverRepo = {
      save: vi.fn(async (d) => {
        drivers.set(`${d.tenantId}:${d.id}`, d);
      }),
      get: vi.fn(async (tid, did) => drivers.get(`${tid}:${did}`) || null),
      setDriverStatus: vi.fn(async (tid, did, status) => {
        const d = drivers.get(`${tid}:${did}`);
        if (d) {
          drivers.set(`${tid}:${did}`, { ...d, status });
        }
      }),
      findNearbyDrivers: vi.fn(async () => Array.from(drivers.values())),
    };

    const sessions = new Map();
    sessionRepo = {
      save: vi.fn(async (s) => {
        sessions.set(`${s.tenantId}:${s.id}`, s);
      }),
      get: vi.fn(async (tid, sid) => sessions.get(`${tid}:${sid}`) || null),
    };

    lockMgr = {
      acquireLock: vi.fn(async () => true),
      releaseLock: vi.fn(async () => {}),
    };

    eventBus = {
      publish: vi.fn(),
    };

    clock = {
      now: vi.fn(() => new Date("2026-06-11T12:00:00Z")),
    };

    idGen = {
      generateTenantId: () => "tnt_test",
      generateDriverId: () => "drv_test",
      generateSessionId: () => "ses_test",
      generateEventId: () => "evt_test",
    };

    metrics = {
      recordMatchingLatency: vi.fn(),
      recordFanoutDuration: vi.fn(),
      incrementAssignmentSuccess: vi.fn(),
      incrementAssignmentTimeout: vi.fn(),
      incrementStaleDetection: vi.fn(),
      incrementDriverLost: vi.fn(),
    };

    logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn((msg, err) => globalThis.console.error(msg, err)),
    };

    configProvider = {
      getTenantOverride: vi.fn(async () => null),
    };
  });

  it("should run fanout next wave and acquire candidate locks", async () => {
    const configMgr = new ConfigurationManager(configProvider);
    const driverMgr = new DriverManager(driverRepo, eventBus, clock, idGen);
    const sessionMgr = new SessionManager(
      sessionRepo,
      lockMgr,
      eventBus,
      clock,
      idGen,
      driverMgr
    );
    const matchingEngine = new MatchingEngine(
      tenantRepo,
      driverRepo,
      clock,
      logger,
      metrics
    );

    const fanout = new FanoutEngine(
      sessionMgr,
      matchingEngine,
      configMgr,
      lockMgr,
      eventBus,
      clock,
      idGen,
      metrics
    );

    // Seed tenant config
    await tenantRepo.save({
      id: "tnt_1",
      name: "Tenant 1",
      matchingConfig: {
        strategy: MatchingStrategy.DISTANCE,
        maxSearchRadius: { value: 15000, unit: "METERS" },
        maxCandidatesPerWave: 3,
      },
      fanoutConfig: { mode: "PARALLEL", intervalSeconds: 5 },
      retryPolicy: {
        maxWaves: 3,
        waveTimeoutSeconds: 8,
        reEvaluationDelaySeconds: 10,
      },
      zones: [],
    });

    // Seed driver
    await driverMgr.registerDriver({
      tenantId: "tnt_1",
      driverId: "drv_1",
      capacity: 1,
      vehicleType: "CAR",
      idempotencyKey: "i1",
    });
    await driverMgr.setDriverOnline("tnt_1", "drv_1");

    const driver = await driverRepo.get("tnt_1", "drv_1");
    await driverRepo.save({
      ...driver,
      location: {
        latitude: 10,
        longitude: 10,
        timestamp: clock.now().toISOString(),
      },
    });

    const session = await sessionMgr.createSession({
      tenantId: "tnt_1",
      sessionId: "ses_1",
      pickup: { latitude: 10, longitude: 10 },
      destination: { latitude: 11, longitude: 11 },
      idempotencyKey: "i_session",
    });

    // Trigger next wave
    await fanout.startNextWave(session);

    expect(lockMgr.acquireLock).toHaveBeenCalledWith("lock:driver:drv_1", 10);
    expect(lockMgr.acquireLock).toHaveBeenCalledWith(
      "lock:candidate:drv_1:session:ses_1",
      8
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: "dispatch.wave.started" })
    );
  });

  it("should accept offer, bind driver capacity, and transition session to DRIVER_ASSIGNED", async () => {
    const configMgr = new ConfigurationManager(configProvider);
    const driverMgr = new DriverManager(driverRepo, eventBus, clock, idGen);
    const sessionMgr = new SessionManager(
      sessionRepo,
      lockMgr,
      eventBus,
      clock,
      idGen,
      driverMgr
    );
    const matchingEngine = new MatchingEngine(
      tenantRepo,
      driverRepo,
      clock,
      logger,
      metrics
    );

    const fanout = new FanoutEngine(
      sessionMgr,
      matchingEngine,
      configMgr,
      lockMgr,
      eventBus,
      clock,
      idGen,
      metrics
    );

    const assignmentMgr = new AssignmentManager(
      sessionRepo,
      lockMgr,
      eventBus,
      clock,
      idGen,
      driverMgr,
      fanout,
      metrics
    );

    // Seed Tenant and Driver
    await tenantRepo.save({
      id: "tnt_1",
      name: "Tenant 1",
      matchingConfig: {
        strategy: MatchingStrategy.DISTANCE,
        maxSearchRadius: { value: 15000, unit: "METERS" },
        maxCandidatesPerWave: 3,
      },
      fanoutConfig: { mode: "PARALLEL", intervalSeconds: 5 },
      retryPolicy: {
        maxWaves: 3,
        waveTimeoutSeconds: 8,
        reEvaluationDelaySeconds: 10,
      },
      zones: [],
    });

    await driverMgr.registerDriver({
      tenantId: "tnt_1",
      driverId: "drv_1",
      capacity: 1,
      vehicleType: "CAR",
      idempotencyKey: "i1",
    });
    await driverMgr.setDriverOnline("tnt_1", "drv_1");

    const driver = await driverRepo.get("tnt_1", "drv_1");
    await driverRepo.save({
      ...driver,
      location: {
        latitude: 10,
        longitude: 10,
        timestamp: clock.now().toISOString(),
      },
    });

    const session = await sessionMgr.createSession({
      tenantId: "tnt_1",
      sessionId: "ses_1",
      pickup: { latitude: 10, longitude: 10 },
      destination: { latitude: 11, longitude: 11 },
      idempotencyKey: "i_session",
    });

    await fanout.startNextWave(session);

    // Load active session with wave
    await sessionMgr.getSession("tnt_1", "ses_1");

    // Accept offer
    await assignmentMgr.acceptSessionOffer("tnt_1", "drv_1", "ses_1", 1);

    const finalSession = await sessionMgr.getSession("tnt_1", "ses_1");
    expect(finalSession.status).toBe(SessionState.DRIVER_ASSIGNED);
    expect(finalSession.assignedDriverId).toBe("drv_1");

    const finalDriver = await driverMgr.getDriver("tnt_1", "drv_1");
    expect(finalDriver.status).toBe(DriverStatus.BUSY);
    expect(finalDriver.currentLoad).toBe(1);

    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: "session.assigned" })
    );
  });

  it("should release locks and abort if session lock fails during wave start update", async () => {
    const configMgr = new ConfigurationManager(configProvider);
    const driverMgr = new DriverManager(driverRepo, eventBus, clock, idGen);
    const sessionMgr = new SessionManager(
      sessionRepo,
      lockMgr,
      eventBus,
      clock,
      idGen,
      driverMgr
    );
    const matchingEngine = new MatchingEngine(
      tenantRepo,
      driverRepo,
      clock,
      logger,
      metrics
    );

    const fanout = new FanoutEngine(
      sessionMgr,
      matchingEngine,
      configMgr,
      lockMgr,
      eventBus,
      clock,
      idGen,
      metrics
    );

    await tenantRepo.save({
      id: "tnt_1",
      name: "Tenant 1",
      matchingConfig: {
        strategy: MatchingStrategy.DISTANCE,
        maxSearchRadius: { value: 15000, unit: "METERS" },
        maxCandidatesPerWave: 3,
      },
      fanoutConfig: { mode: "PARALLEL", intervalSeconds: 5 },
      retryPolicy: {
        maxWaves: 3,
        waveTimeoutSeconds: 8,
        reEvaluationDelaySeconds: 10,
      },
      zones: [],
    });

    await driverMgr.registerDriver({
      tenantId: "tnt_1",
      driverId: "drv_1",
      capacity: 1,
      vehicleType: "CAR",
      idempotencyKey: "i1",
    });
    await driverMgr.setDriverOnline("tnt_1", "drv_1");

    const driver = await driverRepo.get("tnt_1", "drv_1");
    await driverRepo.save({
      ...driver,
      location: {
        latitude: 10,
        longitude: 10,
        timestamp: clock.now().toISOString(),
      },
    });

    const session = await sessionMgr.createSession({
      tenantId: "tnt_1",
      sessionId: "ses_1",
      pickup: { latitude: 10, longitude: 10 },
      destination: { latitude: 11, longitude: 11 },
      idempotencyKey: "i_session",
    });

    // Mock session lock to fail
    lockMgr.acquireLock.mockImplementation(async (key: string) => {
      if (key === "lock:session:ses_1") return false;
      return true;
    });

    const releaseSpy = vi.spyOn(fanout, "releaseWaveLocks");

    await fanout.startNextWave(session);

    expect(releaseSpy).toHaveBeenCalledWith("ses_1", ["drv_1"]);
  });
});
