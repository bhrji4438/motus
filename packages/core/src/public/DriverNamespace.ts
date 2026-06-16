import {
  DriverNamespace as IDriverNamespace,
  RegisterDriverCommand,
  UpdateDriverCommand,
  UpdateDriverLocationCommand,
  DriverResult,
  DriverId,
  TenantId,
  SessionId
} from '@motus/types';
import { DriverManager } from '@/internal/managers/DriverManager.js';

export class DriverNamespace implements IDriverNamespace {
  // These dependencies will be fully resolved in subsequent phases
  private trackingMgr: any;
  private assignmentMgr: any;

  constructor(private readonly driverMgr: DriverManager) {}

  public setDependencies(trackingMgr: any, assignmentMgr: any): void {
    this.trackingMgr = trackingMgr;
    this.assignmentMgr = assignmentMgr;
  }

  public async registerDriver(command: RegisterDriverCommand): Promise<DriverResult> {
    const driver = await this.driverMgr.registerDriver(command);
    return this.mapDriverToResult(driver);
  }

  public async updateDriver(command: UpdateDriverCommand): Promise<DriverResult> {
    const driver = await this.driverMgr.updateDriver(command);
    return this.mapDriverToResult(driver);
  }

  public async getDriver(tenantId: TenantId, driverId: DriverId): Promise<DriverResult> {
    const driver = await this.driverMgr.getDriver(tenantId, driverId);
    return this.mapDriverToResult(driver);
  }

  public async setDriverOnline(tenantId: TenantId, driverId: DriverId): Promise<void> {
    await this.driverMgr.setDriverOnline(tenantId, driverId);
  }

  public async setDriverOffline(tenantId: TenantId, driverId: DriverId): Promise<void> {
    await this.driverMgr.setDriverOffline(tenantId, driverId);
  }

  public async setDriverPaused(tenantId: TenantId, driverId: DriverId): Promise<void> {
    await this.driverMgr.setDriverPaused(tenantId, driverId);
  }

  public async updateDriverLocation(command: UpdateDriverLocationCommand): Promise<void> {
    if (this.trackingMgr) {
      await this.trackingMgr.updateDriverLocation(command);
    }
  }

  public async acceptSessionOffer(
    tenantId: TenantId,
    driverId: DriverId,
    sessionId: SessionId,
    waveNumber: number
  ): Promise<void> {
    if (this.assignmentMgr) {
      await this.assignmentMgr.acceptSessionOffer(tenantId, driverId, sessionId, waveNumber);
    }
  }

  public async rejectSessionOffer(
    tenantId: TenantId,
    driverId: DriverId,
    sessionId: SessionId,
    waveNumber: number
  ): Promise<void> {
    if (this.assignmentMgr) {
      await this.assignmentMgr.rejectSessionOffer(tenantId, driverId, sessionId, waveNumber);
    }
  }

  private mapDriverToResult(driver: any): DriverResult {
    const res: any = {
      id: driver.id,
      tenantId: driver.tenantId,
      status: driver.status,
      capacity: driver.capacity,
      currentLoad: driver.currentLoad,
      vehicleType: driver.vehicleType,
      lastHeartbeat: driver.lastHeartbeat
    };
    if (driver.location && driver.location.latitude !== 0 && driver.location.longitude !== 0) {
      res.lastLocation = {
        latitude: driver.location.latitude,
        longitude: driver.location.longitude
      };
    }
    return res;
  }
}
