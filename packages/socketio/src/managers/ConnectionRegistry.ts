import { TenantId, DriverId } from '@motus/types';
import { AuthContext } from '@/auth/IAuthenticator.js';
import { MetricsManager } from '@/observability/MetricsManager.js';

export interface ConnectionEntry {
  readonly socketId: string;
  readonly tenantId: TenantId;
  readonly driverId?: DriverId;
  readonly userId?: string;
  readonly connectedAt: Date;
  readonly authContext: AuthContext;
  readonly socket: any;
  lastActivityAt: Date;
}

export class ConnectionRegistry {
  private readonly socketIdToConnection = new Map<string, ConnectionEntry>();
  private readonly driverIdToSockets = new Map<DriverId, Set<string>>();
  private readonly userIdToSockets = new Map<string, Set<string>>();
  private readonly tenantIdToSockets = new Map<TenantId, Set<string>>();

  constructor(private readonly metrics: MetricsManager) {}

  public register(socketId: string, authContext: AuthContext, socket: any): ConnectionEntry {
    const entryData: any = {
      socketId,
      tenantId: authContext.tenantId,
      connectedAt: new Date(),
      authContext,
      socket,
      lastActivityAt: new Date(),
    };

    if (authContext.driverId) {
      entryData.driverId = authContext.driverId;
    }
    if (authContext.userId) {
      entryData.userId = authContext.userId;
    }

    const entry = entryData as ConnectionEntry;

    this.socketIdToConnection.set(socketId, entry);

    if (entry.driverId) {
      if (!this.driverIdToSockets.has(entry.driverId)) {
        this.driverIdToSockets.set(entry.driverId, new Set());
      }
      this.driverIdToSockets.get(entry.driverId)!.add(socketId);
      this.metrics.metrics.recordActiveConnection(entry.tenantId, 'driver', this.getDriverConnectionCount(entry.driverId));
    } else {
      const uId = entry.userId ?? 'anonymous';
      if (!this.userIdToSockets.has(uId)) {
        this.userIdToSockets.set(uId, new Set());
      }
      this.userIdToSockets.get(uId)!.add(socketId);
      this.metrics.metrics.recordActiveConnection(entry.tenantId, 'consumer', this.getUserConnectionCount(uId));
    }

    if (!this.tenantIdToSockets.has(entry.tenantId)) {
      this.tenantIdToSockets.set(entry.tenantId, new Set());
    }
    this.tenantIdToSockets.get(entry.tenantId)!.add(socketId);

    this.metrics.logger.debug(`Socket registered in registry`, { socketId, tenantId: entry.tenantId, driverId: entry.driverId });
    return entry;
  }

  public deregister(socketId: string): ConnectionEntry | null {
    const entry = this.socketIdToConnection.get(socketId);
    if (!entry) return null;

    this.socketIdToConnection.delete(socketId);

    if (entry.driverId) {
      const set = this.driverIdToSockets.get(entry.driverId);
      if (set) {
        set.delete(socketId);
        if (set.size === 0) {
          this.driverIdToSockets.delete(entry.driverId);
        }
      }
      this.metrics.metrics.recordActiveConnection(entry.tenantId, 'driver', this.getDriverConnectionCount(entry.driverId));
    } else {
      const uId = entry.userId ?? 'anonymous';
      const set = this.userIdToSockets.get(uId);
      if (set) {
        set.delete(socketId);
        if (set.size === 0) {
          this.userIdToSockets.delete(uId);
        }
      }
      this.metrics.metrics.recordActiveConnection(entry.tenantId, 'consumer', this.getUserConnectionCount(uId));
    }

    const tenantSet = this.tenantIdToSockets.get(entry.tenantId);
    if (tenantSet) {
      tenantSet.delete(socketId);
      if (tenantSet.size === 0) {
        this.tenantIdToSockets.delete(entry.tenantId);
      }
    }

    this.metrics.logger.debug(`Socket deregistered from registry`, { socketId, tenantId: entry.tenantId });
    return entry;
  }

  public getConnection(socketId: string): ConnectionEntry | null {
    return this.socketIdToConnection.get(socketId) ?? null;
  }

  public updateActivity(socketId: string): void {
    const entry = this.socketIdToConnection.get(socketId);
    if (entry) {
      entry.lastActivityAt = new Date();
    }
  }

  public getSocketsByDriver(driverId: DriverId): string[] {
    const set = this.driverIdToSockets.get(driverId);
    return set ? Array.from(set) : [];
  }

  public getSocketsByUser(userId: string): string[] {
    const set = this.userIdToSockets.get(userId);
    return set ? Array.from(set) : [];
  }

  public getSocketsByTenant(tenantId: TenantId): string[] {
    const set = this.tenantIdToSockets.get(tenantId);
    return set ? Array.from(set) : [];
  }

  public getDriverConnectionCount(driverId: DriverId): number {
    return this.driverIdToSockets.get(driverId)?.size ?? 0;
  }

  public getUserConnectionCount(userId: string): number {
    return this.userIdToSockets.get(userId)?.size ?? 0;
  }

  public getActiveConnectionsCount(): number {
    return this.socketIdToConnection.size;
  }

  public getStaleConnections(timeoutMs: number): ConnectionEntry[] {
    const now = Date.now();
    const stale: ConnectionEntry[] = [];
    for (const entry of this.socketIdToConnection.values()) {
      if (now - entry.lastActivityAt.getTime() > timeoutMs) {
        stale.push(entry);
      }
    }
    return stale;
  }

  public clear(): void {
    this.socketIdToConnection.clear();
    this.driverIdToSockets.clear();
    this.userIdToSockets.clear();
    this.tenantIdToSockets.clear();
  }
}
