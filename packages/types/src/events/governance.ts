import { TenantScoped } from '@/domain/value-objects.js';

/**
 * Declares system-level ownership, consumer roles, delivery guarantees,
 * and routing requirements for an asynchronous event contract.
 */
export interface EventGovernanceMetadata {
  /**
   * Originating component or service name (e.g. 'PresenceEngine', 'GeofenceAuditor')
   */
  readonly producer: string;
  /**
   * Intended consumer service names (e.g. ['MatchingEngine', 'SocketServer'])
   */
  readonly consumers: readonly string[];
  /**
   * Quality of Service delivery guarantee.
   */
  readonly deliveryGuarantee: 'AT_LEAST_ONCE' | 'AT_MOST_ONCE';
  /**
   * Scope of sequence ordering constraint.
   */
  readonly orderingScope: 'DRIVER' | 'SESSION' | 'TENANT';
  /**
   * Payload field name used as the routing partition key.
   */
  readonly partitionKey: string;
  /**
   * Guideline or logic explaining deduplication policies.
   */
  readonly idempotencyRequirements: string;
  /**
   * Semantic version tag representing schema compatibility.
   */
  readonly version: string;
}

/**
 * Standardized event envelope wrapping all platform domain events.
 */
export interface EventEnvelope<TName extends string, TPayload> extends TenantScoped {
  /**
   * Globally unique identifier for the event instance (UUIDv4).
   */
  readonly eventId: string;
  /**
   * Canonical event name string matching the events catalog.
   */
  readonly eventName: TName;
  /**
   * UTC ISO 8601 capture time (YYYY-MM-DDTHH:mm:ss.sssZ).
   */
  readonly timestamp: string;
  /**
   * Strongly-typed event-specific data payload.
   */
  readonly payload: TPayload;
  /**
   * Static governance metadata associated with the event contract.
   */
  readonly governance: EventGovernanceMetadata;
}
