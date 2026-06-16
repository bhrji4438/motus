import {
  DriverStatus,
  SessionState,
  MatchingStrategy,
  DispatchWaveStatus,
} from "@/domain/enums.js";
import {
  TenantId,
  DriverId,
  SessionId,
  ZoneId,
  Coordinates,
  Radius,
  Distance,
  Duration,
  ETA,
  TenantScoped,
} from "@/domain/value-objects.js";

/**
 * An enterprise operating zone defining operating boundaries.
 */
export interface Zone {
  readonly zoneId: ZoneId;
  readonly name: string;
  /**
   * The coordinates path forming a closed polygon.
   * First and last coordinate must be identical.
   */
  readonly boundary: readonly Coordinates[];
}

/**
 * Escalation and timeout settings when matching fails.
 */
export interface RetryPolicy {
  /**
   * Maximum waves before matching fails. Range: [1, 20]
   */
  readonly maxWaves: number;
  /**
   * Wave validity window in seconds. Range: [5, 60]
   */
  readonly waveTimeoutSeconds: number;
  /**
   * Cool-down period between waves in seconds.
   */
  readonly reEvaluationDelaySeconds: number;
}

/**
 * Parameters that direct candidate selection algorithms.
 */
export interface MatchingConfiguration {
  readonly strategy: MatchingStrategy;
  readonly maxSearchRadius: Radius;
  readonly maxCandidatesPerWave: number;
}

/**
 * Settings defining how wave assignment notifications are broadcast.
 */
export interface FanoutConfiguration {
  readonly mode: "PARALLEL" | "SERIAL";
  readonly intervalSeconds: number;
}

/**
 * An enterprise partition within the Motus multi-tenant runtime.
 */
export interface Tenant {
  readonly id: TenantId;
  readonly name: string;
  readonly matchingConfig: MatchingConfiguration;
  readonly fanoutConfig: FanoutConfiguration;
  readonly retryPolicy: RetryPolicy;
  readonly zones: readonly Zone[];
}

/**
 * Geographic coordinates and speed/bearing data at a given point in time.
 */
export interface Location extends Coordinates {
  readonly timestamp: string;
}

/**
 * Represents a physical driver available to accept dispatch sessions.
 */
export interface Driver extends TenantScoped {
  readonly id: DriverId;
  readonly status: DriverStatus;
  readonly location: Location;
  readonly currentLoad: number;
  readonly capacity: number;
  readonly lastHeartbeat: string; // ISO 8601 UTC
}

/**
 * A record of a single coordinate point registered during an active session.
 */
export interface TelemetryPoint {
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracy?: number;
  readonly bearing?: number;
  readonly speed?: number;
  readonly timestamp: string; // ISO 8601 UTC
}

/**
 * Represents a historic, immutable state change or user action that occurred during a session.
 */
export interface SessionEvent {
  readonly eventId: string;
  readonly eventName: string;
  readonly timestamp: string; // ISO 8601 UTC
  readonly payload: Record<string, any>;
}

/**
 * An offer block assigning a session to a candidate driver during an active wave.
 */
export interface Assignment {
  readonly driverId: DriverId;
  readonly sessionId: SessionId;
  readonly status: "PENDING" | "ACCEPTED" | "REJECTED" | "EXPIRED";
  readonly lockAcquired: boolean;
}

/**
 * An iteration of candidate matching notifications sent to a prioritized subset of drivers.
 */
export interface DispatchWave {
  readonly waveNumber: number;
  readonly status: DispatchWaveStatus;
  readonly candidates: readonly DriverId[];
  readonly assignments: readonly Assignment[];
  readonly startedAt: string; // ISO 8601 UTC
  readonly expiresAt: string; // ISO 8601 UTC
}

/**
 * Orchestrates a single dispatch order, from creation to completion or cancellation.
 */
export interface Session extends TenantScoped {
  readonly id: SessionId;
  readonly status: SessionState;
  readonly assignedDriverId?: DriverId;
  readonly pickupPoint: Location;
  readonly destinationPoint: Location;
  readonly telemetryPath: readonly TelemetryPoint[];
  readonly eventTimeline: readonly SessionEvent[];
  readonly waves: readonly DispatchWave[];
}

/**
 * A summarized post-mortem aggregate of a completed dispatch session.
 */
export interface SessionReport extends TenantScoped {
  readonly sessionId: SessionId;
  readonly startTime: string; // ISO 8601 UTC
  readonly endTime: string; // ISO 8601 UTC
  readonly totalDistance: Distance;
  readonly totalDuration: Duration;
  readonly initialEstimatedEta: ETA;
  readonly actualPath: readonly TelemetryPoint[];
}
