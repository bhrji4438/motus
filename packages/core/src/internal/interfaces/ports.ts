import {
  Tenant,
  Driver,
  Session,
  Location,
  Coordinates,
  TenantId,
  DriverId,
  SessionId,
  MotusEvent,
  EtaResult,
  Zone,
  DriverStatus,
} from "@motus/types";

export interface ITenantRepository {
  save(tenant: Tenant): Promise<void>;
  get(tenantId: TenantId): Promise<Tenant | null>;
}

export interface IDriverRepository {
  save(driver: Driver): Promise<void>;
  get(tenantId: TenantId, driverId: DriverId): Promise<Driver | null>;
  updateLocation(
    tenantId: TenantId,
    driverId: DriverId,
    location: Location
  ): Promise<void>;
  findNearbyDrivers(
    tenantId: TenantId,
    location: Coordinates,
    radiusMeters: number,
    limit: number
  ): Promise<readonly Driver[]>;
  setDriverStatus(
    tenantId: TenantId,
    driverId: DriverId,
    status: DriverStatus
  ): Promise<void>;
}

export interface ISessionRepository {
  save(session: Session): Promise<void>;
  get(tenantId: TenantId, sessionId: SessionId): Promise<Session | null>;
}

export interface ILockManager {
  acquireLock(key: string, ttlSeconds: number): Promise<boolean>;
  releaseLock(key: string): Promise<void>;
}

export interface IEventBus {
  publish(event: MotusEvent): Promise<void> | void;
}

export interface IConfigurationProvider {
  getTenantOverride(tenantId: TenantId, key: string): Promise<any>;
}

export interface IClock {
  now(): Date;
}

export interface ILogger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

export interface IIdGenerator {
  generateTenantId(): TenantId;
  generateDriverId(): DriverId;
  generateSessionId(): SessionId;
  generateEventId(): string;
}

export interface IEtaProvider {
  calculateEta(
    origin: Coordinates,
    destination: Coordinates
  ): Promise<EtaResult>;
}

export interface IGeofenceProvider {
  isPointInZone(point: Coordinates, zone: Zone): Promise<boolean> | boolean;
}

export interface IMatchingProvider {
  scoreCandidates(
    session: Session,
    candidates: readonly Driver[]
  ): Promise<readonly { readonly driverId: string; readonly score: number }[]>;
}
