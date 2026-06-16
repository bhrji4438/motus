import type { MotusEvent } from '@motus/types';
import { EVENT_GOVERNANCE_REGISTRY } from '@motus/types';

const SEM_VER_REGEX = /^\d+\.\d+\.\d+$/;
const EVENT_NAME_REGEX = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/;
const VALID_DELIVERY_GUARANTEES = new Set(['AT_LEAST_ONCE', 'AT_MOST_ONCE']);
const VALID_ORDERING_SCOPES = new Set(['DRIVER', 'SESSION', 'TENANT', 'GLOBAL']);

/**
 * Validates the full governance contract of a MotusEvent before publishing.
 *
 * Validation levels:
 * - REJECT (throw): invalid field prevents the event from being published.
 * - WARN (log):  advisory issue; event is still published.
 */
export class EventGovernanceValidator {
  /**
   * Validates all governance fields of a MotusEvent.
   * @throws {Error} with a descriptive message if any required field is invalid.
   */
  static validate(event: MotusEvent, warnCallback?: (msg: string) => void): void {
    // ── Core envelope ─────────────────────────────────────────────────────
    if (!event.eventId || event.eventId.trim().length === 0) {
      throw new Error('EventGovernanceValidator: eventId must be a non-empty string.');
    }
    if (!event.eventName || !EVENT_NAME_REGEX.test(event.eventName)) {
      throw new Error(
        `EventGovernanceValidator: eventName "${event.eventName}" is invalid. ` +
          `Must match pattern [a-z][a-z0-9]*(\\.[a-z][a-z0-9]*)+`
      );
    }
    if (!event.timestamp || isNaN(Date.parse(event.timestamp))) {
      throw new Error(
        `EventGovernanceValidator: timestamp "${event.timestamp}" is not a valid ISO 8601 string.`
      );
    }
    if (!event.tenantId || event.tenantId.trim().length === 0) {
      throw new Error('EventGovernanceValidator: tenantId must be a non-empty string.');
    }
    if (event.payload === null || event.payload === undefined || typeof event.payload !== 'object') {
      throw new Error('EventGovernanceValidator: payload must be a non-null object.');
    }

    // ── Governance metadata ───────────────────────────────────────────────
    const { governance } = event;

    if (!governance.producer || governance.producer.trim().length === 0) {
      throw new Error('EventGovernanceValidator: governance.producer must be a non-empty string.');
    }
    if (!Array.isArray(governance.consumers) || governance.consumers.length === 0) {
      throw new Error(
        'EventGovernanceValidator: governance.consumers must be a non-empty array of strings.'
      );
    }
    if (!VALID_DELIVERY_GUARANTEES.has(governance.deliveryGuarantee)) {
      throw new Error(
        `EventGovernanceValidator: governance.deliveryGuarantee "${governance.deliveryGuarantee}" is invalid. ` +
          `Must be one of: ${[...VALID_DELIVERY_GUARANTEES].join(', ')}`
      );
    }
    if (!VALID_ORDERING_SCOPES.has(governance.orderingScope)) {
      throw new Error(
        `EventGovernanceValidator: governance.orderingScope "${governance.orderingScope}" is invalid. ` +
          `Must be one of: ${[...VALID_ORDERING_SCOPES].join(', ')}`
      );
    }
    if (!governance.partitionKey || governance.partitionKey.trim().length === 0) {
      throw new Error(
        'EventGovernanceValidator: governance.partitionKey must be a non-empty string.'
      );
    }
    if (!governance.idempotencyRequirements || governance.idempotencyRequirements.trim().length === 0) {
      throw new Error(
        'EventGovernanceValidator: governance.idempotencyRequirements must be a non-empty string.'
      );
    }
    if (!governance.version || !SEM_VER_REGEX.test(governance.version)) {
      throw new Error(
        `EventGovernanceValidator: governance.version "${governance.version}" must be a valid SemVer string (e.g. "1.0.0").`
      );
    }

    // ── Version check against registry ───────────────────────────────────
    const registered = (EVENT_GOVERNANCE_REGISTRY as Record<string, { version: string }>)[event.eventName];
    if (registered) {
      if (!EventGovernanceValidator.isVersionAtLeast(governance.version, registered.version)) {
        throw new Error(
          `EventGovernanceValidator: governance.version "${governance.version}" for event "${event.eventName}" ` +
            `is older than minimum supported version "${registered.version}".`
        );
      }
    } else if (warnCallback) {
      warnCallback(
        `EventGovernanceValidator: Unknown event name "${event.eventName}". ` +
          `Not in EVENT_GOVERNANCE_REGISTRY. Event will be published (forward compatibility).`
      );
    }

    // ── Advisory: partitionKey present in payload ─────────────────────────
    if (warnCallback && !((governance.partitionKey) in (event.payload as unknown as Record<string, unknown>))) {
      warnCallback(
        `EventGovernanceValidator: governance.partitionKey "${governance.partitionKey}" ` +
          `is not present in payload of event "${event.eventName}".`
      );
    }
  }

  /** Compare two SemVer strings. Returns true if `a` >= `b`. */
  private static isVersionAtLeast(a: string, b: string): boolean {
    const parse = (v: string): number[] => v.split('.').map(Number);
    const [aMajor, aMinor, aPatch] = parse(a);
    const [bMajor, bMinor, bPatch] = parse(b);
    if (aMajor !== bMajor) return aMajor > bMajor;
    if (aMinor !== bMinor) return aMinor > bMinor;
    return aPatch >= bPatch;
  }
}
