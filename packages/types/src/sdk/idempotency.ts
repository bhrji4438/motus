import { TenantScoped } from "@/domain/value-objects.js";

/**
 * A unique client-generated key used to guarantee idempotency for state-mutating requests.
 * Should be formatted as a standard UUIDv4 or secure random string.
 */
export type IdempotencyKey = string;

/**
 * Execution state of an idempotent command session.
 */
export type IdempotencyStatus = "IN_FLIGHT" | "COMPLETED" | "FAILED";

/**
 * Transport-agnostic representation of cached execution state for command replay logs.
 */
export interface IdempotencyMetadata {
  /**
   * The transaction unique reference key.
   */
  readonly key: IdempotencyKey;
  /**
   * Transaction capture timestamp (ISO 8601 UTC).
   */
  readonly timestamp: string;
  readonly status: IdempotencyStatus;
  /**
   * Checksum/hash of the original command payload to verify argument identity.
   */
  readonly payloadHash: string;
  /**
   * The cached outcome payload replayed to the caller on deduplication match.
   */
  readonly cachedResult?: Record<string, any>;
}

/**
 * Base contract that must be extended by all mutating commands requiring idempotency.
 */
export interface IdempotentCommand extends TenantScoped {
  readonly idempotencyKey: IdempotencyKey;
}
