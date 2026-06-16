import { expect } from 'vitest';

export interface EventEnvelope {
  eventId: string;
  eventName: string;
  timestamp: string;
  tenantId: string;
  payload: any;
  governance: {
    producer: string;
    consumers: string[];
    deliveryGuarantee: string;
    orderingScope: string;
    partitionKey: string;
    idempotencyRequirements: string;
    version: string;
  };
}

/**
 * Asserts that an event envelope complies with the global Motus event contract.
 */
export function validateEventEnvelope(event: EventEnvelope): void {
  expect(event).toBeDefined();
  expect(event.eventId).toBeTypeOf('string');
  expect(event.eventName).toBeTypeOf('string');
  expect(event.timestamp).toBeTypeOf('string');
  expect(event.tenantId).toBeTypeOf('string');
  expect(event.payload).toBeDefined();
  expect(event.governance).toBeTypeOf('object');
  expect(event.governance.producer).toBeTypeOf('string');
  expect(event.governance.consumers).toBeTypeOf('object'); // Array
  expect(event.governance.version).toBeTypeOf('string');
}

/**
 * Asserts that a Redis message payload compiles with spatial location updates data rules.
 */
export function validateRedisLocationMessage(message: any): void {
  expect(message).toBeDefined();
  expect(message.latitude).toBeTypeOf('number');
  expect(message.longitude).toBeTypeOf('number');
  expect(message.timestamp).toBeTypeOf('number');
}

/**
 * Asserts that a Socket.IO event complies with room and payload schemas.
 */
export function validateSocketIOEvent(event: string, payload: any): void {
  expect(eventNameIsValid(event)).toBe(true);
  expect(payload).toBeTypeOf('object');
}

function eventNameIsValid(event: string): boolean {
  const validPrefixes = [
    'driver:presence',
    'driver:location',
    'assignment:accept',
    'assignment:reject',
    'session:subscribe',
    'session:unsubscribe',
    'tracking:subscribe',
    'tracking:unsubscribe',
    'session:assigned',
    'tracking:update',
  ];
  return validPrefixes.some((prefix) => event.startsWith(prefix));
}
