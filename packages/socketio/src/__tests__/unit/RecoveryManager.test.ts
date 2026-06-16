import { describe, it, expect, vi } from 'vitest';
import { RecoveryManager } from '@/recovery/RecoveryManager.js';
import { RoomManager } from '@/managers/RoomManager.js';
import { SubscriptionManager } from '@/managers/SubscriptionManager.js';
import { ConnectionRegistry } from '@/managers/ConnectionRegistry.js';
import { MetricsManager } from '@/observability/MetricsManager.js';

describe('RecoveryManager', () => {
  const metricsManager = new MetricsManager();
  const roomManager = new RoomManager(metricsManager);
  const subscriptionManager = new SubscriptionManager(metricsManager);
  const connectionRegistry = new ConnectionRegistry(metricsManager);

  it('recovers authorized tenant and session subscriptions', async () => {
    const recoveryManager = new RecoveryManager(
      roomManager,
      subscriptionManager,
      connectionRegistry,
      metricsManager
    );

    const mockSocket = {
      id: 'socket_1',
      join: vi.fn().mockResolvedValue(undefined),
    };

    // Register connection
    connectionRegistry.register('socket_1', { tenantId: 'tnt_abc' }, mockSocket);

    const recovered = await recoveryManager.recoverSubscriptions(
      'socket_1',
      ['tenant:tnt_abc', 'session:s1', 'tenant:tnt_malicious'],
      5
    );

    // Should only recover tenant:tnt_abc and session:s1 (skips tenant:tnt_malicious due to mismatch)
    expect(recovered).toEqual(['tenant:tnt_abc', 'session:s1']);
    expect(mockSocket.join).toHaveBeenCalledWith('tenant:tnt_abc');
    expect(mockSocket.join).toHaveBeenCalledWith('session:s1');
    expect(mockSocket.join).not.toHaveBeenCalledWith('tenant:tnt_malicious');
  });
});
