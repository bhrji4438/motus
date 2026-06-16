import {
  ServerConfig,
  TelemetryConfig,
  MatchingConfig,
  FanoutConfig,
} from "@motus/types";

export const DEFAULT_SERVER_CONFIG: ServerConfig = {
  port: 3000,
  host: "0.0.0.0",
  jwtSecret: "motus-default-secret-change-me",
  logLevel: "info",
};

export const DEFAULT_TELEMETRY_CONFIG: TelemetryConfig = {
  sampleDistanceMeters: 25,
  sampleIntervalSeconds: 10,
  streamTtlSeconds: 86400, // 24h
};

export const DEFAULT_MATCHING_CONFIG: MatchingConfig = {
  defaultStrategy: "distance",
  initialRadiusMeters: 5000,
  maxRadiusMeters: 15000,
};

export const DEFAULT_FANOUT_CONFIG: FanoutConfig = {
  waveSize: 3,
  waveTimeoutSeconds: 8,
};
