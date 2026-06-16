/**
 * A unique identifier for tenant separation.
 * Matches prefix format: tnt_[a-zA-Z0-9_-]{1,60}
 */
export type TenantId = string;

/**
 * A unique identifier for a driver registry entry.
 * Matches prefix format: drv_[a-zA-Z0-9_-]{1,60}
 */
export type DriverId = string;

/**
 * A unique identifier for tracking sessions.
 * Matches prefix format: ses_[a-zA-Z0-9_-]{1,60}
 */
export type SessionId = string;

/**
 * A globally unique identifier for geofenced regions.
 * Must conform to RFC 4122 UUIDv4 format.
 */
export type ZoneId = string;

/**
 * Represents a geographic location on the surface of the Earth.
 * Adheres to the EPSG:4326 spatial reference system.
 */
export interface Coordinates {
  /**
   * Latitude range: [-90.0, 90.0]
   */
  readonly latitude: number;
  /**
   * Longitude range: [-180.0, 180.0]
   */
  readonly longitude: number;
}

/**
 * A geographic or travel distance measurement.
 */
export interface Distance {
  /**
   * Distance value, must be >= 0.0
   */
  readonly value: number;
  readonly unit: 'METERS' | 'KILOMETERS' | 'MILES';
}

/**
 * A time span representing travel or waiting time.
 */
export interface Duration {
  /**
   * Duration integer value, must be >= 0
   */
  readonly value: number;
  readonly unit: 'SECONDS' | 'MINUTES' | 'HOURS';
}

/**
 * An Estimated Time of Arrival, combining a duration estimate with a target UTC ISO 8601 timestamp.
 */
export interface ETA {
  readonly estimatedDuration: Duration;
  /**
   * UTC ISO 8601 timestamp (YYYY-MM-DDTHH:mm:ss.sssZ)
   */
  readonly targetTime: string;
}

/**
 * A search boundary defining a maximum radius.
 */
export interface Radius {
  /**
   * Radius value, must be > 0.0 and <= 100000.0 (100km)
   */
  readonly value: number;
  readonly unit: 'METERS' | 'KILOMETERS';
}

/**
 * A tenant-defined vehicle classification identifier contract.
 * Allowed characters: Uppercase alphanumeric and underscores (e.g., ^[A-Z0-9_]{1,30}$).
 */
export type VehicleType = string;

/**
 * Generic operational status configuration wrapped with state details.
 */
export interface Status {
  /**
   * Alphanumeric, uppercase, maximum 50 characters.
   */
  readonly code: string;
  /**
   * Optional explanation, maximum 255 characters.
   */
  readonly reason?: string;
}

/**
 * Enforces tenant scoping across shared entities, aggregates, SDK commands, queries, results, and events.
 */
export interface TenantScoped {
  readonly tenantId: TenantId;
}
