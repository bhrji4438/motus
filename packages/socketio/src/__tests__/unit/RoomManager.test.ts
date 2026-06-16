import { describe, it, expect, vi } from 'vitest';
import { RoomManager } from '@/managers/RoomManager.js';
import { MetricsManager } from '@/observability/MetricsManager.js';

describe('RoomManager', () => {
  const mockMetrics = {
    recordSubscription: vi.fn(),
    recordUnsubscription: vi.fn(),
    recordActiveConnection: vi.fn(),
    recordHeartbeat: vi.fn(),
    recordMessageSent: vi.fn(),
    recordMessageReceived: vi.fn(),
    recordBroadcast: vi.fn(),
    recordDeliveryLatency: vi.fn(),
    recordSocketError: vi.fn(),
  };

  const metricsManager = new MetricsManager({ metrics: mockMetrics as any });
  const roomManager = new RoomManager(metricsManager);

  it('formats tenant room correctly', () => {
    expect(roomManager.tenantRoom('tnt_123')).toBe('tenant:tnt_123');
  });

  it('formats driver room correctly', () => {
    expect(roomManager.driverRoom('drv_456')).toBe('driver:drv_456');
  });

  it('formats session room correctly', () => {
    expect(roomManager.sessionRoom('ses_789')).toBe('session:ses_789');
  });

  it('formats tracking room correctly', () => {
    expect(roomManager.trackingRoom('ses_789')).toBe('tracking:ses_789');
  });

  it('handles socket join and records metrics', async () => {
    const mockSocket = {
      id: 'socket_abc',
      join: vi.fn().mockResolvedValue(undefined),
    };

    await roomManager.joinRoom(mockSocket as any, 'session:ses_123', 'tnt_abc');

    expect(mockSocket.join).toHaveBeenCalledWith('session:ses_123');
    expect(mockMetrics.recordSubscription).toHaveBeenCalledWith('tnt_abc', 'session');
  });

  it('handles socket leave and records metrics', async () => {
    const mockSocket = {
      id: 'socket_abc',
      leave: vi.fn().mockResolvedValue(undefined),
    };

    await roomManager.leaveRoom(mockSocket as any, 'tracking:ses_123', 'tnt_abc');

    expect(mockSocket.leave).toHaveBeenCalledWith('tracking:ses_123');
    expect(mockMetrics.recordUnsubscription).toHaveBeenCalledWith('tnt_abc', 'tracking');
  });
});
