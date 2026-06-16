import { MotusEvent, EVENT_GOVERNANCE_REGISTRY } from '@motus/types';
import { EventMetadata } from '@/internal/events/EventMetadata.js';
import { EventGovernance } from '@/internal/events/EventGovernance.js';
import { ContractVersionValidator } from '@/internal/events/ContractVersionValidator.js';
import { ErrorFactory } from '@/internal/errors/ErrorFactory.js';

export class EventValidator {
  private readonly metadataVal = new EventMetadata();
  private readonly governanceVal = new EventGovernance();
  private readonly versionVal = new ContractVersionValidator();

  public validate(event: MotusEvent): void {
    // 1. Envelope Format Checks
    if (!event.eventId || !this.metadataVal.validateEventId(event.eventId)) {
      throw ErrorFactory.invalidArgument('eventId', 'Event ID must be a valid UUIDv4.');
    }
    if (!event.timestamp || !this.metadataVal.validateTimestamp(event.timestamp)) {
      throw ErrorFactory.invalidArgument('timestamp', 'Timestamp must be a valid ISO 8601 UTC string.');
    }
    if (!event.tenantId || !this.metadataVal.validateTenantId(event.tenantId)) {
      throw ErrorFactory.invalidArgument('tenantId', 'Tenant ID must conform to prefix format (tnt_).');
    }

    // 2. Governance Registry Checks
    const registry = EVENT_GOVERNANCE_REGISTRY[event.eventName];
    if (!registry) {
      throw ErrorFactory.invalidArgument('eventName', `Event name '${event.eventName}' is not registered in the system.`);
    }

    // 3. Producer Verification
    if (!this.governanceVal.isAuthorizedProducer(event.eventName, event.governance.producer)) {
      throw ErrorFactory.invalidArgument(
        'governance.producer',
        `Producer '${event.governance.producer}' is not authorized for event '${event.eventName}'. Expected: '${registry.producer}'`
      );
    }

    // 4. Contract Version Verification
    if (!this.versionVal.isCompatible(event.governance.version, registry.version)) {
      throw ErrorFactory.invalidArgument(
        'governance.version',
        `Schema version '${event.governance.version}' is incompatible with registered version '${registry.version}'.`
      );
    }

    // 5. Partition Key Invariant Check
    const partitionKey = this.governanceVal.getPartitionKey(event.eventName);
    if (partitionKey && event.payload) {
      const payloadVal = (event.payload as any)[partitionKey];
      if (payloadVal === undefined || payloadVal === null) {
        throw ErrorFactory.invalidArgument(
          'payload',
          `Event payload is missing required partition key field: '${partitionKey}'.`
        );
      }
    }
  }
}
