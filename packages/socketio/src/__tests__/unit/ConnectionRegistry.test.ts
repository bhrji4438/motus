import { describe, it, expect, vi } from 'vitest';
import { ConnectionRegistry } from '@/managers/ConnectionRegistry.js';
import { MetricsManager } from '@/observability/MetricsManager.js';

describe('ConnectionRegistry', () => {
  const mockMetrics = {
    recordActiveConnection: vi.fn(),
    recordSocketError: vi.fn(),
  };
  const metricsManager = new MetricsManager({ metrics: mockMetrics as any });

  it('registers and indexes connection correctly', () => {
    const registry = new ConnectionRegistry(metricsManager);
    const mockSocket = { id: 'socket_1' };
    const auth = { tenantId: 'tnt_1', driverId: 'drv_1' };

    const entry = registry.register('socket_1', auth, mockSocket);

    expect(entry.socketId).toBe('socket_1');
    expect(entry.tenantId).toBe('tnt_1');
    expect(entry.driverId).toBe('drv_1');

    expect(registry.getConnection('socket_1')).toBe(entry);
    expect(registry.getSocketsByDriver('drv_1')).toEqual(['socket_1']);
    expect(registry.getDriverConnectionCount('drv_1')).toBe(1);
    expect(registry.getActiveConnectionsCount()).toBe(1);
  });

  it('supports multiple devices for same driver', () => {
    const registry = new ConnectionRegistry(metricsManager);
    const auth = { tenantId: 'tnt_1', driverId: 'drv_1' };

    registry.register('socket_1', auth, { id: 'socket_1' });
    registry.register('socket_2', auth, { id: 'socket_2' });

    expect(registry.getSocketsByDriver('drv_1')).toEqual(['socket_1', 'socket_2']);
    expect(registry.getDriverConnectionCount('drv_1')).toBe(2);
    expect(registry.getActiveConnectionsCount()).toBe(2);
  });

  it('deregisters connection and updates indexes', () => {
    const registry = new ConnectionRegistry(metricsManager);
    const auth = { tenantId: 'tnt_1', driverId: 'drv_1' };

    registry.register('socket_1', auth, { id: 'socket_1' });
    const deregistered = registry.deregister('socket_1');

    expect(deregistered?.socketId).toBe('socket_1');
    expect(registry.getConnection('socket_1')).toBeNull();
    expect(registry.getSocketsByDriver('drv_1')).toEqual([]);
    expect(registry.getDriverConnectionCount('drv_1')).toBe(0);
    expect(registry.getActiveConnectionsCount()).toBe(0);
  });

  it('detects stale connections correctly', async () => {
    const registry = new ConnectionRegistry(metricsManager);
    const auth = { tenantId: 'tnt_1', userId: 'user_1' };

    const entry = registry.register('socket_1', auth, { id: 'socket_1' });

    // Set last activity manually in past
    entry.lastActivityAt = new Date(Date.now() - 10000);

    const stale = registry.getStaleConnections(5000);
    expect(stale.length).toBe(1);
    expect(stale[0].socketId).toBe('socket_1');
  });
});
