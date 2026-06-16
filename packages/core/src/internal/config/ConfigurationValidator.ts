import {
  ServerConfig,
  TelemetryConfig,
  MatchingConfig,
  FanoutConfig,
} from "@motus/types";
import { ErrorFactory } from "@/internal/errors/ErrorFactory.js";

export class ConfigurationValidator {
  public validateServer(config: ServerConfig): void {
    if (config.port < 1 || config.port > 65535) {
      throw ErrorFactory.invalidArgument(
        "port",
        `Port must be in range [1, 65535]. Provided: ${config.port}`
      );
    }
    if (!config.host) {
      throw ErrorFactory.invalidArgument(
        "host",
        "Host bind address must not be empty."
      );
    }
    if (!config.jwtSecret || config.jwtSecret.trim() === "") {
      throw ErrorFactory.invalidArgument(
        "jwtSecret",
        "JWT Secret must not be empty."
      );
    }
    const validLogLevels = ["debug", "info", "warn", "error"];
    if (!validLogLevels.includes(config.logLevel)) {
      throw ErrorFactory.invalidArgument(
        "logLevel",
        `Log level must be one of: ${validLogLevels.join(", ")}. Provided: ${
          config.logLevel
        }`
      );
    }
  }

  public validateTelemetry(config: TelemetryConfig): void {
    if (config.sampleDistanceMeters <= 0) {
      throw ErrorFactory.invalidArgument(
        "sampleDistanceMeters",
        "Sample distance meters must be positive."
      );
    }
    if (config.sampleIntervalSeconds <= 0) {
      throw ErrorFactory.invalidArgument(
        "sampleIntervalSeconds",
        "Sample interval seconds must be positive."
      );
    }
    if (config.streamTtlSeconds <= 0) {
      throw ErrorFactory.invalidArgument(
        "streamTtlSeconds",
        "Stream TTL seconds must be positive."
      );
    }
  }

  public validateMatching(config: MatchingConfig): void {
    const validStrategies = ["distance", "eta"];
    if (!validStrategies.includes(config.defaultStrategy)) {
      throw ErrorFactory.invalidArgument(
        "defaultStrategy",
        `Matching default strategy must be one of: ${validStrategies.join(
          ", "
        )}. Provided: ${config.defaultStrategy}`
      );
    }
    if (
      config.initialRadiusMeters <= 0 ||
      config.initialRadiusMeters > 100000
    ) {
      throw ErrorFactory.invalidArgument(
        "initialRadiusMeters",
        "Initial radius meters must be in range (0, 100000]."
      );
    }
    if (config.maxRadiusMeters <= 0 || config.maxRadiusMeters > 100000) {
      throw ErrorFactory.invalidArgument(
        "maxRadiusMeters",
        "Max radius meters must be in range (0, 100000]."
      );
    }
    if (config.initialRadiusMeters > config.maxRadiusMeters) {
      throw ErrorFactory.invalidArgument(
        "initialRadiusMeters",
        `Initial search radius (${config.initialRadiusMeters}m) must not exceed maximum search radius (${config.maxRadiusMeters}m).`
      );
    }
  }

  public validateFanout(config: FanoutConfig): void {
    if (config.waveSize < 1 || config.waveSize > 20) {
      throw ErrorFactory.invalidArgument(
        "waveSize",
        "Fanout waveSize must be in range [1, 20]."
      );
    }
    if (config.waveTimeoutSeconds < 5 || config.waveTimeoutSeconds > 60) {
      throw ErrorFactory.invalidArgument(
        "waveTimeoutSeconds",
        "Fanout waveTimeoutSeconds must be in range [5, 60]."
      );
    }
  }
}
