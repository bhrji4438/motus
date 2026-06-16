export interface DriverStatusDetail {
  driverId: string;
  tenantId: string;
  status: 'ONLINE' | 'BUSY' | 'PAUSED' | 'STALE' | 'OFFLINE';
  location: { latitude: number; longitude: number; timestamp: string };
  lastHeartbeat: string;
}

export class DispatchMonitor {
  private drivers = new Map<string, DriverStatusDetail>();

  constructor() {
    // Register some mock driver records
    this.drivers.set('driver-1', {
      driverId: 'driver-1',
      tenantId: 'T1',
      status: 'ONLINE',
      location: { latitude: 37.7749, longitude: -122.4194, timestamp: new Date().toISOString() },
      lastHeartbeat: new Date().toISOString(),
    });
    this.drivers.set('driver-2', {
      driverId: 'driver-2',
      tenantId: 'T1',
      status: 'BUSY',
      location: { latitude: 37.7849, longitude: -122.4094, timestamp: new Date().toISOString() },
      lastHeartbeat: new Date().toISOString(),
    });
    this.drivers.set('driver-3', {
      driverId: 'driver-3',
      tenantId: 'T1',
      status: 'STALE',
      location: { latitude: 37.7949, longitude: -122.3994, timestamp: new Date().toISOString() },
      lastHeartbeat: new Date().toISOString(),
    });
  }

  /**
   * List live driver statistics per status within a tenant.
   */
  public async getDriverStatusCounts(tenantId: string): Promise<Record<string, number>> {
    const counts = { ONLINE: 0, BUSY: 0, PAUSED: 0, STALE: 0, OFFLINE: 0 };
    for (const driver of this.drivers.values()) {
      if (driver.tenantId === tenantId) {
        counts[driver.status]++;
      }
    }
    return counts;
  }

  /**
   * Get detail list of drivers and locations.
   */
  public async listDrivers(tenantId: string, status?: string): Promise<DriverStatusDetail[]> {
    return Array.from(this.drivers.values()).filter(
      d => d.tenantId === tenantId && (!status || d.status === status)
    );
  }

  /**
   * Update location driver presence from SSE/WebSocket triggers.
   */
  public updateDriverLocation(
    tenantId: string,
    driverId: string,
    location: { latitude: number; longitude: number },
    status: DriverStatusDetail['status'] = 'ONLINE'
  ): void {
    const record = this.drivers.get(driverId) || {
      driverId,
      tenantId,
      status,
      location: { ...location, timestamp: new Date().toISOString() },
      lastHeartbeat: new Date().toISOString(),
    };
    record.location = { ...location, timestamp: new Date().toISOString() };
    record.status = status;
    record.lastHeartbeat = new Date().toISOString();
    this.drivers.set(driverId, record);
  }
}

// Global default dispatch monitor
export const defaultDispatchMonitor = new DispatchMonitor();
export default defaultDispatchMonitor;
