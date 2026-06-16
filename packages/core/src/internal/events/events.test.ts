import { describe, it, expect, vi } from 'vitest';
import { EventMetadata } from '@/internal/events/EventMetadata.js';
import { ContractVersionValidator } from '@/internal/events/ContractVersionValidator.js';
import { EventGovernance } from '@/internal/events/EventGovernance.js';
import { EventValidator } from '@/internal/events/EventValidator.js';
import { EventDispatcher } from '@/internal/events/EventDispatcher.js';
import { MotusEvent } from '@motus/types';

describe('EventMetadata', () => {
  const metadata = new EventMetadata();

  it('should validate UUIDv4 event IDs correctly', () => {
    expect(metadata.validateEventId('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d')).toBe(true);
    expect(metadata.validateEventId('not-a-uuid')).toBe(false);
  });

  it('should validate ISO 8601 UTC timestamps correctly', () => {
    expect(metadata.validateTimestamp('2026-06-11T14:15:16.123Z')).toBe(true);
    expect(metadata.validateTimestamp('2026-06-11T14:15:16Z')).toBe(true);
    expect(metadata.validateTimestamp('2026-06-11 14:15:16')).toBe(false);
    expect(metadata.validateTimestamp('invalid-date')).toBe(false);
  });

  it('should validate Tenant ID prefix format correctly', () => {
    expect(metadata.validateTenantId('tnt_12345')).toBe(true);
    expect(metadata.validateTenantId('tnt_abc-def_ghi')).toBe(true);
    expect(metadata.validateTenantId('tnt_')).toBe(false);
    expect(metadata.validateTenantId('drv_123')).toBe(false);
  });
});

describe('ContractVersionValidator', () => {
  const validator = new ContractVersionValidator();

  it('should assert compatibility based on semantic version rules', () => {
    // Exact match
    expect(validator.isCompatible('1.0.0', '1.0.0')).toBe(true);
    // Greater minor version (backward compatible)
    expect(validator.isCompatible('1.1.0', '1.0.0')).toBe(true);
    // Lower minor version (incompatible)
    expect(validator.isCompatible('1.0.0', '1.1.0')).toBe(false);
    // Different major versions (incompatible)
    expect(validator.isCompatible('2.0.0', '1.0.0')).toBe(false);
    // Invalid format
    expect(validator.isCompatible('1.0', '1.0.0')).toBe(false);
  });
});

describe('EventGovernance', () => {
  const governance = new EventGovernance();

  it('should verify authorized producers', () => {
    expect(governance.isAuthorizedProducer('tenant.created', 'TenantService')).toBe(true);
    expect(governance.isAuthorizedProducer('tenant.created', 'InvalidProducer')).toBe(false);
    expect(governance.isAuthorizedProducer('invalid.event' as any, 'AnyProducer')).toBe(false);
  });

  it('should resolve partition key field names', () => {
    expect(governance.getPartitionKey('tenant.created')).toBe('tenantId');
    expect(governance.getPartitionKey('driver.online')).toBe('driverId');
    expect(governance.getPartitionKey('invalid.event' as any)).toBe(null);
  });
});

describe('EventValidator', () => {
  const validator = new EventValidator();

  const getValidEvent = (): MotusEvent => ({
    eventId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    eventName: 'driver.online',
    timestamp: '2026-06-11T14:00:00Z',
    tenantId: 'tnt_tenant123',
    payload: {
      tenantId: 'tnt_tenant123',
      driverId: 'drv_driver123',
      capacity: 1
    },
    governance: {
      producer: 'PresenceEngine',
      consumers: ['MatchingEngine', 'SocketServer'],
      deliveryGuarantee: 'AT_LEAST_ONCE',
      orderingScope: 'DRIVER',
      partitionKey: 'driverId',
      idempotencyRequirements: 'Deduplicate',
      version: '1.0.0'
    }
  });

  it('should succeed validation for valid event envelope and governance rules', () => {
    expect(() => validator.validate(getValidEvent())).not.toThrow();
  });

  it('should throw error for invalid eventId', () => {
    const event = { ...getValidEvent(), eventId: 'invalid-uuid' };
    expect(() => validator.validate(event)).toThrow('Event ID must be a valid UUIDv4.');
  });

  it('should throw error for invalid timestamp', () => {
    const event = { ...getValidEvent(), timestamp: '2026-06-11 14:00:00' };
    expect(() => validator.validate(event)).toThrow('Timestamp must be a valid ISO 8601 UTC string.');
  });

  it('should throw error for invalid tenantId prefix', () => {
    const event = { ...getValidEvent(), tenantId: 'tenant123' as any };
    expect(() => validator.validate(event)).toThrow('Tenant ID must conform to prefix format (tnt_).');
  });

  it('should throw error for unregistered eventName', () => {
    const event = { ...getValidEvent(), eventName: 'non.existent.event' as any };
    expect(() => validator.validate(event)).toThrow("is not registered in the system.");
  });

  it('should throw error for unauthorized producer', () => {
    const event = {
      ...getValidEvent(),
      governance: { ...getValidEvent().governance, producer: 'WrongProducer' }
    };
    expect(() => validator.validate(event)).toThrow("is not authorized for event");
  });

  it('should throw error for incompatible versions', () => {
    const event = {
      ...getValidEvent(),
      governance: { ...getValidEvent().governance, version: '2.0.0' }
    };
    expect(() => validator.validate(event)).toThrow("is incompatible with registered version");
  });

  it('should throw error for missing partition key', () => {
    const event = {
      ...getValidEvent(),
      payload: { tenantId: 'tnt_tenant123' } as any
    };
    expect(() => validator.validate(event)).toThrow("Event payload is missing required partition key field");
  });
});

describe('EventDispatcher', () => {
  const getValidEvent = (): MotusEvent => ({
    eventId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    eventName: 'driver.online',
    timestamp: '2026-06-11T14:00:00Z',
    tenantId: 'tnt_tenant123',
    payload: {
      tenantId: 'tnt_tenant123',
      driverId: 'drv_driver123',
      capacity: 1
    },
    governance: {
      producer: 'PresenceEngine',
      consumers: ['MatchingEngine', 'SocketServer'],
      deliveryGuarantee: 'AT_LEAST_ONCE',
      orderingScope: 'DRIVER',
      partitionKey: 'driverId',
      idempotencyRequirements: 'Deduplicate',
      version: '1.0.0'
    }
  });

  it('should validate and dispatch events to registered listeners', async () => {
    const dispatcher = new EventDispatcher();
    const handler = vi.fn();
    
    dispatcher.on('driver.online', handler);
    await dispatcher.publish(getValidEvent());
    
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ eventName: 'driver.online' }));
  });

  it('should unsubscribe listeners correctly with off', async () => {
    const dispatcher = new EventDispatcher();
    const handler = vi.fn();
    
    dispatcher.on('driver.online', handler);
    dispatcher.off('driver.online', handler);
    await dispatcher.publish(getValidEvent());
    
    expect(handler).not.toHaveBeenCalled();
  });

  it('should trigger listeners only once with once', async () => {
    const dispatcher = new EventDispatcher();
    const handler = vi.fn();
    
    dispatcher.once('driver.online', handler);
    await dispatcher.publish(getValidEvent());
    await dispatcher.publish(getValidEvent());
    
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should support wildcard pattern matching', async () => {
    const dispatcher = new EventDispatcher();
    const globalHandler = vi.fn();
    const driverHandler = vi.fn();
    const sessionHandler = vi.fn();

    dispatcher.on('*', globalHandler);
    dispatcher.on('driver.*', driverHandler);
    dispatcher.on('session.*', sessionHandler);

    await dispatcher.publish(getValidEvent());

    expect(globalHandler).toHaveBeenCalledTimes(1);
    expect(driverHandler).toHaveBeenCalledTimes(1);
    expect(sessionHandler).not.toHaveBeenCalled();
  });

  it('should catch handler execution errors and not crash publishing', async () => {
    const dispatcher = new EventDispatcher();
    const badHandler = vi.fn().mockRejectedValue(new Error('crash'));
    const goodHandler = vi.fn();

    dispatcher.on('driver.online', badHandler);
    dispatcher.on('driver.online', goodHandler);

    await expect(dispatcher.publish(getValidEvent())).resolves.not.toThrow();
    expect(badHandler).toHaveBeenCalledTimes(1);
    expect(goodHandler).toHaveBeenCalledTimes(1);
  });
});
