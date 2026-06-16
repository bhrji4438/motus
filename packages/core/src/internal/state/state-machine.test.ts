import { describe, it, expect } from "vitest";
import { DriverStatus, SessionState } from "@motus/types";
import { StateMachineManager } from "@/internal/state/StateMachineManager.js";
import {
  ErrorFactory,
  MotusCoreError,
} from "@/internal/errors/ErrorFactory.js";
import {
  TenantEntity,
  DriverEntity,
  SessionEntity,
  SessionReportEntity,
} from "@/internal/entities/entities.js";

describe("Phase 1 Foundations: Entities", () => {
  it("should initialize TenantEntity with properties", () => {
    const tenant = new TenantEntity(
      "tnt_123",
      "Test Tenant",
      {
        strategy: "DISTANCE",
        maxSearchRadius: { value: 5000, unit: "METERS" },
        maxCandidatesPerWave: 3,
      } as any,
      { mode: "PARALLEL", intervalSeconds: 5 } as any,
      {
        maxWaves: 3,
        waveTimeoutSeconds: 8,
        reEvaluationDelaySeconds: 10,
      } as any
    );
    expect(tenant.id).toBe("tnt_123");
    expect(tenant.name).toBe("Test Tenant");
    expect(tenant.zones).toEqual([]);
  });

  it("should initialize DriverEntity with properties", () => {
    const driver = new DriverEntity(
      "tnt_123",
      "drv_456",
      DriverStatus.ONLINE,
      {
        latitude: 12.9716,
        longitude: 77.5946,
        timestamp: "2026-06-11T12:00:00Z",
      },
      0,
      1,
      "2026-06-11T12:00:00Z"
    );
    expect(driver.id).toBe("drv_456");
    expect(driver.status).toBe(DriverStatus.ONLINE);
    expect(driver.location.latitude).toBe(12.9716);
  });

  it("should initialize SessionEntity and SessionReportEntity", () => {
    const session = new SessionEntity(
      "tnt_123",
      "ses_789",
      SessionState.CREATED,
      {
        latitude: 12.9716,
        longitude: 77.5946,
        timestamp: "2026-06-11T12:00:00Z",
      },
      {
        latitude: 12.9718,
        longitude: 77.5948,
        timestamp: "2026-06-11T12:00:00Z",
      }
    );
    expect(session.id).toBe("ses_789");
    expect(session.status).toBe(SessionState.CREATED);

    const report = new SessionReportEntity(
      "tnt_123",
      "ses_789",
      "2026-06-11T12:00:00Z",
      "2026-06-11T12:15:00Z",
      { value: 1.2, unit: "KILOMETERS" },
      { value: 15, unit: "MINUTES" },
      {
        estimatedDuration: { value: 12, unit: "MINUTES" },
        targetTime: "2026-06-11T12:12:00Z",
      }
    );
    expect(report.sessionId).toBe("ses_789");
    expect(report.totalDistance.value).toBe(1.2);
  });
});

describe("Phase 1 Foundations: Error Subsystem", () => {
  it("should create custom MotusCoreError and respect factories", () => {
    const err = ErrorFactory.driverNotFound("drv_1", "tnt_1");
    expect(err).toBeInstanceOf(MotusCoreError);
    expect(err.code).toBe("MOTUS_DRIVER_NOT_FOUND");
    expect(err.details).toEqual({ driverId: "drv_1", tenantId: "tnt_1" });

    const transitionErr = ErrorFactory.invalidTransition(
      "CREATED",
      "COMPLETED",
      "Test cause"
    );
    expect(transitionErr.code).toBe("MOTUS_INVALID_TRANSITION");
    expect(transitionErr.cause).toBe("Test cause");
  });
});

describe("Phase 1 Foundations: State Machine Engine", () => {
  const manager = new StateMachineManager();

  it("should validate driver transitions correctly", () => {
    // Valid: Offline -> Online
    expect(() =>
      manager.validateDriverTransition(
        DriverStatus.OFFLINE,
        DriverStatus.ONLINE,
        { currentLoad: 0, capacity: 1 }
      )
    ).not.toThrow();

    // Invalid: Offline -> Busy
    expect(() =>
      manager.validateDriverTransition(
        DriverStatus.OFFLINE,
        DriverStatus.BUSY,
        { currentLoad: 0, capacity: 1 }
      )
    ).toThrow();

    // Guard: Online -> Paused when load is > 0
    expect(() =>
      manager.validateDriverTransition(
        DriverStatus.ONLINE,
        DriverStatus.PAUSED,
        { currentLoad: 1, capacity: 2 }
      )
    ).toThrow();

    // Guard: Online -> Paused when load is 0
    expect(() =>
      manager.validateDriverTransition(
        DriverStatus.ONLINE,
        DriverStatus.PAUSED,
        { currentLoad: 0, capacity: 2 }
      )
    ).not.toThrow();
  });

  it("should validate session transitions correctly", () => {
    // Valid: Created -> Searching
    expect(() =>
      manager.validateSessionTransition(
        SessionState.CREATED,
        SessionState.SEARCHING
      )
    ).not.toThrow();

    // Invalid: Created -> Completed
    expect(() =>
      manager.validateSessionTransition(
        SessionState.CREATED,
        SessionState.COMPLETED
      )
    ).toThrow();

    // Guard: Terminal state is immutable
    expect(() =>
      manager.validateSessionTransition(
        SessionState.COMPLETED,
        SessionState.SEARCHING
      )
    ).toThrow();

    // Guard: Driver lost recovery restoring previous state
    expect(() =>
      manager.validateSessionTransition(
        SessionState.DRIVER_LOST,
        SessionState.IN_PROGRESS,
        {
          previousState: SessionState.IN_PROGRESS,
        }
      )
    ).not.toThrow();

    expect(() =>
      manager.validateSessionTransition(
        SessionState.DRIVER_LOST,
        SessionState.IN_PROGRESS,
        {
          previousState: SessionState.DRIVER_EN_ROUTE,
        }
      )
    ).toThrow();
  });
});
