import { MotusEvent, EVENT_GOVERNANCE_REGISTRY } from '@motus/types';

export class EventGovernance {
  /**
   * Asserts whether a producer is authorized to issue a specific event type.
   */
  public isAuthorizedProducer(eventName: MotusEvent['eventName'], producer: string): boolean {
    const metadata = EVENT_GOVERNANCE_REGISTRY[eventName];
    if (!metadata) {
      return false;
    }
    return metadata.producer === producer;
  }

  /**
   * Resolves the partition key field name for an event.
   */
  public getPartitionKey(eventName: MotusEvent['eventName']): string | null {
    const metadata = EVENT_GOVERNANCE_REGISTRY[eventName];
    return metadata ? metadata.partitionKey : null;
  }
}
