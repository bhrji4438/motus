import { MatchingStrategy } from "@/domain/enums.js";
import {
  TenantScoped,
  DriverId,
  SessionId,
  Coordinates,
  VehicleType,
} from "@/domain/value-objects.js";
import { IdempotentCommand } from "@/sdk/idempotency.js";

/**
 * Registers a new tenant partition workspace with specific matching rules.
 */
export interface RegisterTenantCommand extends IdempotentCommand {
  /**
   * Name of the tenant. Length range: [3, 100].
   */
  readonly name: string;
  readonly matchingStrategy: MatchingStrategy;
  /**
   * Default timeout for offers in seconds. Default: 10, Range: [5, 60].
   */
  readonly waveTimeoutSeconds?: number;
  /**
   * Maximum concurrent tasks per driver. Default: 1, Range: [1, 20].
   */
  readonly maxCapacityPerDriver?: number;
  /**
   * Service boundaries.
   */
  readonly geofences?: ReadonlyArray<{
    readonly name: string;
    readonly boundary: readonly Coordinates[];
  }>;
}

/**
 * Modifies configuration metrics for an existing tenant workspace.
 */
export interface UpdateTenantCommand extends TenantScoped {
  readonly name?: string;
  readonly matchingStrategy?: MatchingStrategy;
  readonly waveTimeoutSeconds?: number;
  readonly maxCapacityPerDriver?: number;
  readonly geofences?: ReadonlyArray<{
    readonly name: string;
    readonly boundary: readonly Coordinates[];
  }>;
}

/**
 * Initializes a new driver presence tracker.
 */
export interface RegisterDriverCommand extends IdempotentCommand {
  readonly driverId: DriverId;
  /**
   * Maximum concurrent assignments allowed. Default: 1, Range: [1, 10].
   */
  readonly capacity?: number;
  readonly vehicleType: VehicleType;
}

/**
 * Updates operational criteria (e.g. capacity limits) for a driver.
 */
export interface UpdateDriverCommand extends TenantScoped {
  readonly driverId: DriverId;
  readonly capacity?: number;
  readonly vehicleType?: VehicleType;
}

/**
 * Ingests a new real-time geographic location update for a driver.
 */
export interface UpdateDriverLocationCommand extends TenantScoped {
  readonly driverId: DriverId;
  readonly latitude: number;
  readonly longitude: number;
  /**
   * Horizontal accuracy circle in meters.
   */
  readonly accuracy?: number;
  /**
   * Heading angle (0.0 to 360.0).
   */
  readonly bearing?: number;
  /**
   * Speed in meters per second (0.0 to 100.0).
   */
  readonly speed?: number;
  /**
   * UTC ISO 8601 capture timestamp.
   */
  readonly timestamp: string;
}

/**
 * Initializes a new dispatch and tracking session.
 */
export interface CreateSessionCommand extends IdempotentCommand {
  readonly sessionId: SessionId;
  readonly pickup: Coordinates;
  readonly destination: Coordinates;
  readonly requiredVehicleType?: VehicleType;
}

/**
 * Concludes an active session.
 */
export interface CompleteSessionCommand extends IdempotentCommand {
  readonly sessionId: SessionId;
}

/**
 * Terminates a session early.
 */
export interface CancelSessionCommand extends IdempotentCommand {
  readonly sessionId: SessionId;
  readonly reason?: string;
}

/**
 * Forces driver reallocation and resets matching waves.
 */
export interface ReassignSessionCommand extends IdempotentCommand {
  readonly sessionId: SessionId;
  readonly reason?: string;
}

/**
 * Submits an acceptance decision for a dispatch offer.
 */
export interface AcceptSessionOfferCommand extends IdempotentCommand {
  readonly driverId: DriverId;
  readonly sessionId: SessionId;
  readonly waveNumber: number;
}

/**
 * Rejects an active dispatch offer to accelerate escalation.
 */
export interface RejectSessionOfferCommand extends IdempotentCommand {
  readonly driverId: DriverId;
  readonly sessionId: SessionId;
  readonly waveNumber: number;
}
