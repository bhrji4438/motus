import { describe, it, expect } from 'vitest';
import { CorrelationContext } from '@/logger/CorrelationContext.js';

describe('CorrelationContext', () => {
  it('should generate a default correlation ID when not specified', () => {
    const id = CorrelationContext.generateId();
    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('should run a callback within context and preserve fields', () => {
    const context = {
      correlationId: 'test-corr-id',
      tenantId: 'tenant-123',
      sessionId: 'session-456',
    };

    CorrelationContext.run(context, () => {
      expect(CorrelationContext.getCorrelationId()).toBe('test-corr-id');
      expect(CorrelationContext.getTenantId()).toBe('tenant-123');
      expect(CorrelationContext.getSessionId()).toBe('session-456');

      const store = CorrelationContext.getStore();
      expect(store).toBeDefined();
      expect(store?.correlationId).toBe('test-corr-id');
    });
  });

  it('should automatically generate a correlationId if run is called with empty context', () => {
    CorrelationContext.run({}, () => {
      const corrId = CorrelationContext.getCorrelationId();
      expect(corrId).toBeDefined();
      expect(typeof corrId).toBe('string');
      expect(corrId.split('-').length).toBe(5); // UUID v4 format check
    });
  });

  it('should return undefined for tenantId/sessionId outside of context run', () => {
    expect(CorrelationContext.getTenantId()).toBeUndefined();
    expect(CorrelationContext.getSessionId()).toBeUndefined();
  });
});
