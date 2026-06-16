/**
 * Defines the connection and presence state of a driver in the real-time presence engine.
 */
export enum DriverStatus {
  OFFLINE = 'OFFLINE',
  ONLINE = 'ONLINE',
  BUSY = 'BUSY',
  PAUSED = 'PAUSED',
  STALE = 'STALE'
}

/**
 * Defines the sequential lifecycle states of a tracking and dispatch session.
 */
export enum SessionState {
  CREATED = 'CREATED',
  SEARCHING = 'SEARCHING',
  DRIVER_ASSIGNED = 'DRIVER_ASSIGNED',
  DRIVER_EN_ROUTE = 'DRIVER_EN_ROUTE',
  ARRIVED = 'ARRIVED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  DRIVER_LOST = 'DRIVER_LOST'
}

/**
 * The algorithm strategy used by the matching engine to score and rank driver candidates.
 */
export enum MatchingStrategy {
  DISTANCE = 'DISTANCE',
  ETA = 'ETA',
  CUSTOM = 'CUSTOM'
}

/**
 * Configures the location ingestion sampling filters, controlling bandwidth vs coordinate accuracy trade-offs.
 */
export enum TelemetryProfile {
  LOW_FREQUENCY = 'LOW_FREQUENCY',
  BALANCED = 'BALANCED',
  HIGH_ACCURACY = 'HIGH_ACCURACY'
}

/**
 * Represents the current state of a progressive candidate matching notification wave.
 */
export enum DispatchWaveStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED'
}

/**
 * Indicates why a driver presence transitioned to DRIVER_LOST or STALE.
 */
export enum DriverLostReason {
  HEARTBEAT_MISSING = 'HEARTBEAT_MISSING',
  CLIENT_DISCONNECT = 'CLIENT_DISCONNECT',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT'
}

/**
 * Standardized error identifiers returned by the API and SDK.
 */
export enum ErrorCode {
  MOTUS_DRIVER_NOT_FOUND = 'MOTUS_DRIVER_NOT_FOUND',
  MOTUS_SESSION_NOT_FOUND = 'MOTUS_SESSION_NOT_FOUND',
  MOTUS_INVALID_TRANSITION = 'MOTUS_INVALID_TRANSITION',
  MOTUS_DRIVER_BUSY = 'MOTUS_DRIVER_BUSY',
  MOTUS_CAPACITY_EXCEEDED = 'MOTUS_CAPACITY_EXCEEDED',
  MOTUS_INVALID_VEHICLE_TYPE = 'MOTUS_INVALID_VEHICLE_TYPE',
  MOTUS_LOCK_ACQUISITION_FAILED = 'MOTUS_LOCK_ACQUISITION_FAILED',
  MOTUS_INVALID_ARGUMENT = 'MOTUS_INVALID_ARGUMENT',
  MOTUS_UNAUTHORIZED = 'MOTUS_UNAUTHORIZED',
  MOTUS_INTERNAL_ERROR = 'MOTUS_INTERNAL_ERROR'
}
