import { Session, Driver, Zone } from '@/domain/models.js';
import { Coordinates, Duration } from '@/domain/value-objects.js';
import { MotusEvent } from '@/events/events.js';

/**
 * Represents candidate driver ranking score.
 */
export interface CandidateScore {
  readonly driverId: string;
  /**
   * Numeric score, higher is better.
   */
  readonly score: number;
}

/**
 * Result representation returned by OSRM or Google Maps routing service.
 */
export interface EtaResult {
  readonly durationSeconds: number;
  readonly distanceMeters: number;
}

/**
 * Pluggable contract allowing tenants to override default spatial candidate scoring.
 */
export interface MatchingProvider {
  /**
   * Scores eligible driver candidates based on session parameters.
   */
  scoreCandidates(
    session: Session,
    candidates: readonly Driver[]
  ): readonly CandidateScore[] | Promise<readonly CandidateScore[]>;
}

/**
 * Pluggable contract for mapping coordinates to road-network ETA travel duration.
 */
export interface EtaProvider {
  /**
   * Calculates estimated transit time and distance between coordinates.
   */
  calculateEta(origin: Coordinates, destination: Coordinates): EtaResult | Promise<EtaResult>;
}

/**
 * Pluggable contract verifying coordinates mapping against operating boundaries.
 */
export interface GeofencingProvider {
  /**
   * Determines if a point coordinate lies within an active polygon service zone.
   */
  isPointInZone(point: Coordinates, zone: Zone): boolean | Promise<boolean>;
}

/**
 * Pluggable contract governing route trace storage density.
 */
export interface TelemetryProvider {
  /**
   * Determines if an incoming coordinate should be appended to the session trace.
   */
  shouldSample(
    lastSampledLocation: Coordinates,
    newLocation: Coordinates,
    elapsedDuration: Duration
  ): boolean | Promise<boolean>;
}

/**
 * Pluggable contract routing outbox events to external message brokers.
 */
export interface EventAdapter {
  /**
   * Submits a structured, immutable outbox event to external clients.
   */
  publish(event: MotusEvent): void | Promise<void>;
}
