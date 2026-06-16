import { Coordinates, TenantId, DriverId, SessionId } from '@/domain/value-objects.js';
import { EventEnvelope, EventGovernanceMetadata } from '@/events/governance.js';

// ==========================================
// 1. EVENT PAYLOADS
// ==========================================

export interface TenantCreatedPayload {
  readonly tenantId: TenantId;
  readonly name: string;
}

export interface DriverOnlinePayload {
  readonly tenantId: TenantId;
  readonly driverId: DriverId;
  readonly capacity: number;
}

export interface DriverOfflinePayload {
  readonly tenantId: TenantId;
  readonly driverId: DriverId;
  readonly reason: 'MANUAL_DISCONNECT' | 'HEARTBEAT_TIMEOUT';
}

export interface DriverPausedPayload {
  readonly tenantId: TenantId;
  readonly driverId: DriverId;
}

export interface DriverLocationUpdatedPayload {
  readonly tenantId: TenantId;
  readonly driverId: DriverId;
  readonly location: Coordinates;
  readonly speed?: number;
  readonly bearing?: number;
}

export interface TelemetrySampledPayload {
  readonly tenantId: TenantId;
  readonly sessionId: SessionId;
  readonly driverId: DriverId;
  readonly location: Coordinates;
}

export interface SessionCreatedPayload {
  readonly tenantId: TenantId;
  readonly sessionId: SessionId;
  readonly pickup: Coordinates;
  readonly destination: Coordinates;
}

export interface SessionSearchingPayload {
  readonly tenantId: TenantId;
  readonly sessionId: SessionId;
}

export interface SessionAssignedPayload {
  readonly tenantId: TenantId;
  readonly sessionId: SessionId;
  readonly assignedDriverId: DriverId;
  readonly estimatedDurationSeconds: number;
}

export interface SessionArrivedPayload {
  readonly tenantId: TenantId;
  readonly sessionId: SessionId;
  readonly driverId: DriverId;
}

export interface SessionStartedPayload {
  readonly tenantId: TenantId;
  readonly sessionId: SessionId;
  readonly driverId: DriverId;
}

export interface SessionCompletedPayload {
  readonly tenantId: TenantId;
  readonly sessionId: SessionId;
  readonly driverId: DriverId;
}

export interface SessionCancelledPayload {
  readonly tenantId: TenantId;
  readonly sessionId: SessionId;
  readonly reason?: string;
}

export interface SessionDriverLostPayload {
  readonly tenantId: TenantId;
  readonly sessionId: SessionId;
  readonly lastKnownLocation?: Coordinates;
}

export interface DispatchWaveStartedPayload {
  readonly tenantId: TenantId;
  readonly sessionId: SessionId;
  readonly waveNumber: number;
  readonly candidates: readonly DriverId[];
  readonly expiresAt: string; // ISO 8601 UTC
}

export interface DispatchWaveCompletedPayload {
  readonly tenantId: TenantId;
  readonly sessionId: SessionId;
  readonly waveNumber: number;
  readonly acceptedDriverId: DriverId;
}

export interface DispatchNoDriverFoundPayload {
  readonly tenantId: TenantId;
  readonly sessionId: SessionId;
}

// ==========================================
// 2. TYPED EVENT ENVELOPES
// ==========================================

export type TenantCreatedEvent = EventEnvelope<'tenant.created', TenantCreatedPayload>;
export type DriverOnlineEvent = EventEnvelope<'driver.online', DriverOnlinePayload>;
export type DriverOfflineEvent = EventEnvelope<'driver.offline', DriverOfflinePayload>;
export type DriverPausedEvent = EventEnvelope<'driver.paused', DriverPausedPayload>;
export type DriverLocationUpdatedEvent = EventEnvelope<'driver.location.updated', DriverLocationUpdatedPayload>;
export type TelemetrySampledEvent = EventEnvelope<'telemetry.sampled', TelemetrySampledPayload>;
export type SessionCreatedEvent = EventEnvelope<'session.created', SessionCreatedPayload>;
export type SessionSearchingEvent = EventEnvelope<'session.searching', SessionSearchingPayload>;
export type SessionAssignedEvent = EventEnvelope<'session.assigned', SessionAssignedPayload>;
export type SessionArrivedEvent = EventEnvelope<'session.arrived', SessionArrivedPayload>;
export type SessionStartedEvent = EventEnvelope<'session.started', SessionStartedPayload>;
export type SessionCompletedEvent = EventEnvelope<'session.completed', SessionCompletedPayload>;
export type SessionCancelledEvent = EventEnvelope<'session.cancelled', SessionCancelledPayload>;
export type SessionDriverLostEvent = EventEnvelope<'session.driver_lost', SessionDriverLostPayload>;
export type DispatchWaveStartedEvent = EventEnvelope<'dispatch.wave.started', DispatchWaveStartedPayload>;
export type DispatchWaveCompletedEvent = EventEnvelope<'dispatch.wave.completed', DispatchWaveCompletedPayload>;
export type DispatchNoDriverFoundEvent = EventEnvelope<'dispatch.no_driver_found', DispatchNoDriverFoundPayload>;

/**
 * Union of all canonical event envelopes supported by the Motus system.
 */
export type MotusEvent =
  | TenantCreatedEvent
  | DriverOnlineEvent
  | DriverOfflineEvent
  | DriverPausedEvent
  | DriverLocationUpdatedEvent
  | TelemetrySampledEvent
  | SessionCreatedEvent
  | SessionSearchingEvent
  | SessionAssignedEvent
  | SessionArrivedEvent
  | SessionStartedEvent
  | SessionCompletedEvent
  | SessionCancelledEvent
  | SessionDriverLostEvent
  | DispatchWaveStartedEvent
  | DispatchWaveCompletedEvent
  | DispatchNoDriverFoundEvent;

// ==========================================
// 3. CENTRALIZED GOVERNANCE REGISTRY
// ==========================================

export const EVENT_GOVERNANCE_REGISTRY: { readonly [K in MotusEvent['eventName']]: EventGovernanceMetadata } = {
  'tenant.created': {
    producer: 'TenantService',
    consumers: ['BillingEngine', 'SocketServer'],
    deliveryGuarantee: 'AT_LEAST_ONCE',
    orderingScope: 'TENANT',
    partitionKey: 'tenantId',
    idempotencyRequirements: 'Deduplicate by event ID to prevent duplicate database creation operations.',
    version: '1.0.0'
  },
  'driver.online': {
    producer: 'PresenceEngine',
    consumers: ['MatchingEngine', 'SocketServer'],
    deliveryGuarantee: 'AT_LEAST_ONCE',
    orderingScope: 'DRIVER',
    partitionKey: 'driverId',
    idempotencyRequirements: 'Deduplicate by state transition timestamp to skip late-arriving offline states.',
    version: '1.0.0'
  },
  'driver.offline': {
    producer: 'PresenceEngine',
    consumers: ['DispatchEngine', 'SocketServer'],
    deliveryGuarantee: 'AT_LEAST_ONCE',
    orderingScope: 'DRIVER',
    partitionKey: 'driverId',
    idempotencyRequirements: 'Process in sequence, cancel driver reservations upon receipt.',
    version: '1.0.0'
  },
  'driver.paused': {
    producer: 'PresenceEngine',
    consumers: ['MatchingEngine'],
    deliveryGuarantee: 'AT_LEAST_ONCE',
    orderingScope: 'DRIVER',
    partitionKey: 'driverId',
    idempotencyRequirements: 'Process sequentially, pause dispatch updates.',
    version: '1.0.0'
  },
  'driver.location.updated': {
    producer: 'LocationIngestion',
    consumers: ['GeofenceAuditor', 'SocketServer'],
    deliveryGuarantee: 'AT_MOST_ONCE',
    orderingScope: 'DRIVER',
    partitionKey: 'driverId',
    idempotencyRequirements: 'Discard out-of-order locations by checking update timestamp sequence.',
    version: '1.0.0'
  },
  'telemetry.sampled': {
    producer: 'TelemetrySampler',
    consumers: ['SessionHistory', 'SocketServer'],
    deliveryGuarantee: 'AT_LEAST_ONCE',
    orderingScope: 'SESSION',
    partitionKey: 'sessionId',
    idempotencyRequirements: 'Append point to historical route path sequentially.',
    version: '1.0.0'
  },
  'session.created': {
    producer: 'SessionService',
    consumers: ['MatchingEngine', 'SocketServer'],
    deliveryGuarantee: 'AT_LEAST_ONCE',
    orderingScope: 'SESSION',
    partitionKey: 'sessionId',
    idempotencyRequirements: 'Deduplicate by sessionId, initialize session lifecycle context.',
    version: '1.0.0'
  },
  'session.searching': {
    producer: 'DispatchEngine',
    consumers: ['MatchingEngine', 'SocketServer'],
    deliveryGuarantee: 'AT_LEAST_ONCE',
    orderingScope: 'SESSION',
    partitionKey: 'sessionId',
    idempotencyRequirements: 'Avoid triggering multiple matching candidate searches concurrently.',
    version: '1.0.0'
  },
  'session.assigned': {
    producer: 'DispatchEngine',
    consumers: ['TrackingEngine', 'SocketServer'],
    deliveryGuarantee: 'AT_LEAST_ONCE',
    orderingScope: 'SESSION',
    partitionKey: 'sessionId',
    idempotencyRequirements: 'Lock driver assignment exclusively to prevent double allocation.',
    version: '1.0.0'
  },
  'session.arrived': {
    producer: 'GeofenceAuditor',
    consumers: ['TrackingEngine', 'SocketServer'],
    deliveryGuarantee: 'AT_LEAST_ONCE',
    orderingScope: 'SESSION',
    partitionKey: 'sessionId',
    idempotencyRequirements: 'Trigger notification and update state machine context.',
    version: '1.0.0'
  },
  'session.started': {
    producer: 'SessionService',
    consumers: ['TrackingEngine', 'SocketServer'],
    deliveryGuarantee: 'AT_LEAST_ONCE',
    orderingScope: 'SESSION',
    partitionKey: 'sessionId',
    idempotencyRequirements: 'Deduplicate, begin route telemetry buffering.',
    version: '1.0.0'
  },
  'session.completed': {
    producer: 'SessionService',
    consumers: ['ReportGenerator', 'SocketServer'],
    deliveryGuarantee: 'AT_LEAST_ONCE',
    orderingScope: 'SESSION',
    partitionKey: 'sessionId',
    idempotencyRequirements: 'Deduplicate, trigger session report compiler pipeline.',
    version: '1.0.0'
  },
  'session.cancelled': {
    producer: 'SessionService',
    consumers: ['FanoutEngine', 'SocketServer'],
    deliveryGuarantee: 'AT_LEAST_ONCE',
    orderingScope: 'SESSION',
    partitionKey: 'sessionId',
    idempotencyRequirements: 'Deduplicate, release driver reservations, terminate outstanding offers.',
    version: '1.0.0'
  },
  'session.driver_lost': {
    producer: 'PresenceMonitor',
    consumers: ['DispatchEngine', 'SocketServer'],
    deliveryGuarantee: 'AT_LEAST_ONCE',
    orderingScope: 'SESSION',
    partitionKey: 'sessionId',
    idempotencyRequirements: 'Initiate session recovery grace period timer.',
    version: '1.0.0'
  },
  'dispatch.wave.started': {
    producer: 'FanoutEngine',
    consumers: ['SocketServer'],
    deliveryGuarantee: 'AT_LEAST_ONCE',
    orderingScope: 'SESSION',
    partitionKey: 'sessionId',
    idempotencyRequirements: 'Notify candidates, start wave timer check.',
    version: '1.0.0'
  },
  'dispatch.wave.completed': {
    producer: 'FanoutEngine',
    consumers: ['SessionService', 'SocketServer'],
    deliveryGuarantee: 'AT_LEAST_ONCE',
    orderingScope: 'SESSION',
    partitionKey: 'sessionId',
    idempotencyRequirements: 'Clear outstanding wave assignments, update assigned driver.',
    version: '1.0.0'
  },
  'dispatch.no_driver_found': {
    producer: 'MatchingEngine',
    consumers: ['SessionService', 'SocketServer'],
    deliveryGuarantee: 'AT_LEAST_ONCE',
    orderingScope: 'SESSION',
    partitionKey: 'sessionId',
    idempotencyRequirements: 'Escalate matching rules or transition session to cancelled.',
    version: '1.0.0'
  }
};
