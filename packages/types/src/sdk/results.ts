import { DriverStatus, SessionState, MatchingStrategy } from '@/domain/enums.js';
import {
  TenantId,
  DriverId,
  SessionId,
  Coordinates,
  VehicleType,
  TenantScoped
} from '@/domain/value-objects.js';

/**
 * Result returned by tenant-related commands and queries.
 */
export interface TenantResult extends TenantScoped {
  readonly id: TenantId;
  readonly name: string;
  readonly matchingStrategy: MatchingStrategy;
  readonly waveTimeoutSeconds: number;
  readonly maxCapacityPerDriver: number;
  readonly geofences: ReadonlyArray<{
    readonly name: string;
    readonly boundary: readonly Coordinates[];
  }>;
}

/**
 * Result returned by driver presence and registry lookups.
 */
export interface DriverResult extends TenantScoped {
  readonly id: DriverId;
  readonly status: DriverStatus;
  readonly capacity: number;
  readonly currentLoad: number;
  readonly vehicleType: VehicleType;
  readonly lastLocation?: Coordinates;
  readonly lastHeartbeat: string; // ISO 8601 UTC
}

/**
 * Result representing session details returned by commands and queries.
 */
export interface SessionResult extends TenantScoped {
  readonly id: SessionId;
  readonly status: SessionState;
  readonly assignedDriverId?: DriverId;
  readonly pickup: Coordinates;
  readonly destination: Coordinates;
  readonly createdAt: string; // ISO 8601 UTC
  readonly updatedAt: string; // ISO 8601 UTC
}

/**
 * Summary telemetry and performance report result.
 */
export interface SessionReportResult extends TenantScoped {
  readonly sessionId: SessionId;
  readonly startTime: string; // ISO 8601 UTC
  readonly endTime: string; // ISO 8601 UTC
  readonly totalDistanceMeters: number;
  readonly totalDurationSeconds: number;
  readonly estimatedEtaSeconds: number;
  readonly actualPath: readonly Coordinates[];
}

/**
 * Proposal assignment details returned by fanout queries.
 */
export interface AssignmentResult extends TenantScoped {
  readonly sessionId: SessionId;
  readonly waveNumber: number;
  readonly driverId: DriverId;
  readonly status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  readonly expiresAt: string; // ISO 8601 UTC
}

/**
 * Outcome wrapper containing historical event logs.
 */
export interface EventResult extends TenantScoped {
  readonly eventId: string;
  readonly eventName: string;
  readonly timestamp: string; // ISO 8601 UTC
  readonly payload: Record<string, any>;
}
