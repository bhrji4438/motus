import { describe, it, expect, vi } from "vitest";
import { ConfigurationValidator } from "@/internal/config/ConfigurationValidator.js";
import { ConfigurationManager } from "@/public/config/ConfigurationManager.js";
import {
  DEFAULT_MATCHING_CONFIG,
  DEFAULT_FANOUT_CONFIG,
  DEFAULT_TELEMETRY_CONFIG,
} from "@/internal/config/DefaultConfiguration.js";

describe("ConfigurationValidator", () => {
  const validator = new ConfigurationValidator();

  describe("validateServer", () => {
    const validConfig = {
      port: 8080,
      host: "0.0.0.0",
      jwtSecret: "supersecret",
      logLevel: "info" as const,
    };

    it("should pass on valid server config", () => {
      expect(() => validator.validateServer(validConfig)).not.toThrow();
    });

    it("should fail on invalid port", () => {
      expect(() =>
        validator.validateServer({ ...validConfig, port: 0 })
      ).toThrow("Port must be in range");
      expect(() =>
        validator.validateServer({ ...validConfig, port: 70000 })
      ).toThrow("Port must be in range");
    });

    it("should fail on empty host", () => {
      expect(() =>
        validator.validateServer({ ...validConfig, host: "" })
      ).toThrow("Host bind address must not be empty.");
    });

    it("should fail on empty jwtSecret", () => {
      expect(() =>
        validator.validateServer({ ...validConfig, jwtSecret: "" })
      ).toThrow("JWT Secret must not be empty.");
      expect(() =>
        validator.validateServer({ ...validConfig, jwtSecret: "   " })
      ).toThrow("JWT Secret must not be empty.");
    });

    it("should fail on invalid logLevel", () => {
      expect(() =>
        validator.validateServer({ ...validConfig, logLevel: "invalid" as any })
      ).toThrow("Log level must be one of:");
    });
  });

  describe("validateTelemetry", () => {
    const validConfig = {
      sampleDistanceMeters: 25,
      sampleIntervalSeconds: 10,
      streamTtlSeconds: 86400,
    };

    it("should pass on valid telemetry config", () => {
      expect(() => validator.validateTelemetry(validConfig)).not.toThrow();
    });

    it("should fail on invalid distance", () => {
      expect(() =>
        validator.validateTelemetry({ ...validConfig, sampleDistanceMeters: 0 })
      ).toThrow("Sample distance meters must be positive.");
    });

    it("should fail on invalid interval", () => {
      expect(() =>
        validator.validateTelemetry({
          ...validConfig,
          sampleIntervalSeconds: -5,
        })
      ).toThrow("Sample interval seconds must be positive.");
    });

    it("should fail on invalid TTL", () => {
      expect(() =>
        validator.validateTelemetry({ ...validConfig, streamTtlSeconds: 0 })
      ).toThrow("Stream TTL seconds must be positive.");
    });
  });

  describe("validateMatching", () => {
    const validConfig = {
      defaultStrategy: "distance" as const,
      initialRadiusMeters: 2000,
      maxRadiusMeters: 10000,
    };

    it("should pass on valid matching config", () => {
      expect(() => validator.validateMatching(validConfig)).not.toThrow();
    });

    it("should fail on invalid defaultStrategy", () => {
      expect(() =>
        validator.validateMatching({
          ...validConfig,
          defaultStrategy: "invalid" as any,
        })
      ).toThrow("Matching default strategy must be one of:");
    });

    it("should fail on invalid initialRadiusMeters", () => {
      expect(() =>
        validator.validateMatching({ ...validConfig, initialRadiusMeters: 0 })
      ).toThrow("Initial radius meters must be in range");
      expect(() =>
        validator.validateMatching({
          ...validConfig,
          initialRadiusMeters: 150000,
        })
      ).toThrow("Initial radius meters must be in range");
    });

    it("should fail on invalid maxRadiusMeters", () => {
      expect(() =>
        validator.validateMatching({ ...validConfig, maxRadiusMeters: 0 })
      ).toThrow("Max radius meters must be in range");
    });

    it("should fail if initialRadiusMeters exceeds maxRadiusMeters", () => {
      expect(() =>
        validator.validateMatching({
          ...validConfig,
          initialRadiusMeters: 12000,
          maxRadiusMeters: 10000,
        })
      ).toThrow("must not exceed maximum search radius");
    });
  });

  describe("validateFanout", () => {
    const validConfig = {
      waveSize: 5,
      waveTimeoutSeconds: 8,
    };

    it("should pass on valid fanout config", () => {
      expect(() => validator.validateFanout(validConfig)).not.toThrow();
    });

    it("should fail on invalid waveSize", () => {
      expect(() =>
        validator.validateFanout({ ...validConfig, waveSize: 0 })
      ).toThrow("Fanout waveSize must be in range [1, 20].");
      expect(() =>
        validator.validateFanout({ ...validConfig, waveSize: 25 })
      ).toThrow("Fanout waveSize must be in range [1, 20].");
    });

    it("should fail on invalid waveTimeoutSeconds", () => {
      expect(() =>
        validator.validateFanout({ ...validConfig, waveTimeoutSeconds: 4 })
      ).toThrow("Fanout waveTimeoutSeconds must be in range [5, 60].");
      expect(() =>
        validator.validateFanout({ ...validConfig, waveTimeoutSeconds: 61 })
      ).toThrow("Fanout waveTimeoutSeconds must be in range [5, 60].");
    });
  });
});

describe("ConfigurationManager", () => {
  it("should fallback to defaults when configProvider returns null", async () => {
    const provider = {
      getTenantOverride: vi.fn().mockResolvedValue(null),
    };
    const manager = new ConfigurationManager(provider);

    const matchConfig = await manager.getMatchingConfig("tnt_1");
    expect(matchConfig).toEqual(DEFAULT_MATCHING_CONFIG);

    const fanoutConfig = await manager.getFanoutConfig("tnt_1");
    expect(fanoutConfig).toEqual(DEFAULT_FANOUT_CONFIG);

    const telemetryConfig = await manager.getTelemetryConfig("tnt_1");
    expect(telemetryConfig).toEqual(DEFAULT_TELEMETRY_CONFIG);
  });

  it("should apply tenant overrides when configProvider returns overrides", async () => {
    const provider = {
      getTenantOverride: vi.fn().mockImplementation(async (_tid, key) => {
        if (key === "matching.initialRadiusMeters") return 4000;
        if (key === "matching.maxRadiusMeters") return 20000;
        if (key === "fanout.waveSize") return 12;
        if (key === "telemetry.streamTtlSeconds") return 7200;
        if (key === "features.new-routing") return true;
        return null;
      }),
    };
    const manager = new ConfigurationManager(provider);

    const matchConfig = await manager.getMatchingConfig("tnt_1");
    expect(matchConfig.initialRadiusMeters).toBe(4000);
    expect(matchConfig.maxRadiusMeters).toBe(20000);

    const fanoutConfig = await manager.getFanoutConfig("tnt_1");
    expect(fanoutConfig.waveSize).toBe(12);

    const telemetryConfig = await manager.getTelemetryConfig("tnt_1");
    expect(telemetryConfig.streamTtlSeconds).toBe(7200);

    const featureEnabled = await manager.isFeatureEnabled(
      "tnt_1",
      "new-routing"
    );
    expect(featureEnabled).toBe(true);
  });
});
