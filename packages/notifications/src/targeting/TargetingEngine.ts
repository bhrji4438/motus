export interface DeviceToken {
  tenantId: string;
  recipientId: string; // userId or driverId
  token: string;
  platform: 'ios' | 'android' | 'web';
  registeredAt: string;
  failuresCount: number;
}

export class TargetingEngine {
  private tokens = new Map<string, DeviceToken[]>(); // Key: tenantId:recipientId

  private getKey(tenantId: string, recipientId: string): string {
    return `${tenantId}:${recipientId}`;
  }

  /**
   * Register a new device token.
   */
  public async registerToken(
    tenantId: string,
    recipientId: string,
    token: string,
    platform: 'ios' | 'android' | 'web'
  ): Promise<void> {
    const key = this.getKey(tenantId, recipientId);
    const list = this.tokens.get(key) || [];

    // Avoid duplicate token records
    const existing = list.find(t => t.token === token);
    if (existing) {
      Object.assign(existing, { registeredAt: new Date().toISOString(), failuresCount: 0 });
    } else {
      list.push({
        tenantId,
        recipientId,
        token,
        platform,
        registeredAt: new Date().toISOString(),
        failuresCount: 0,
      });
    }

    this.tokens.set(key, list);
  }

  /**
   * Deregister a specific token.
   */
  public async deregisterToken(tenantId: string, recipientId: string, token: string): Promise<void> {
    const key = this.getKey(tenantId, recipientId);
    const list = this.tokens.get(key) || [];
    const filtered = list.filter(t => t.token !== token);
    this.tokens.set(key, filtered);
  }

  /**
   * Get all registered active tokens for a specific user within a tenant.
   */
  public async getTokensForUser(tenantId: string, recipientId: string): Promise<DeviceToken[]> {
    const key = this.getKey(tenantId, recipientId);
    return this.tokens.get(key) || [];
  }

  /**
   * Mark a token as failed, incrementing the counter. If it fails too many times, it gets deregistered.
   */
  public async recordFailure(tenantId: string, recipientId: string, token: string): Promise<void> {
    const key = this.getKey(tenantId, recipientId);
    const list = this.tokens.get(key) || [];
    const record = list.find(t => t.token === token);
    if (record) {
      record.failuresCount++;
      if (record.failuresCount >= 3) {
        // Automatically prune dead/invalid tokens after 3 consecutive failures
        await this.deregisterToken(tenantId, recipientId, token);
      }
    }
  }
}
