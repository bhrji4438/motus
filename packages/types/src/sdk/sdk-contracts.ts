import { TenantId, DriverId, SessionId } from "@/domain/value-objects.js";
import { MotusEvent } from "@/events/events.js";
import {
  RegisterTenantCommand,
  UpdateTenantCommand,
  RegisterDriverCommand,
  UpdateDriverCommand,
  UpdateDriverLocationCommand,
  CreateSessionCommand,
  CancelSessionCommand,
  CompleteSessionCommand,
  ReassignSessionCommand,
} from "@/sdk/commands.js";
import {
  TenantResult,
  DriverResult,
  SessionResult,
  SessionReportResult,
  EventResult,
} from "@/sdk/results.js";

export interface TenantNamespace {
  registerTenant(command: RegisterTenantCommand): Promise<TenantResult>;
  updateTenant(command: UpdateTenantCommand): Promise<TenantResult>;
  getTenant(tenantId: TenantId): Promise<TenantResult>;
}

export interface DriverNamespace {
  registerDriver(command: RegisterDriverCommand): Promise<DriverResult>;
  updateDriver(command: UpdateDriverCommand): Promise<DriverResult>;
  getDriver(tenantId: TenantId, driverId: DriverId): Promise<DriverResult>;
  setDriverOnline(tenantId: TenantId, driverId: DriverId): Promise<void>;
  setDriverOffline(tenantId: TenantId, driverId: DriverId): Promise<void>;
  setDriverPaused(tenantId: TenantId, driverId: DriverId): Promise<void>;
  updateDriverLocation(command: UpdateDriverLocationCommand): Promise<void>;
  acceptSessionOffer(
    tenantId: TenantId,
    driverId: DriverId,
    sessionId: SessionId,
    waveNumber: number
  ): Promise<void>;
  rejectSessionOffer(
    tenantId: TenantId,
    driverId: DriverId,
    sessionId: SessionId,
    waveNumber: number
  ): Promise<void>;
}

export interface SessionNamespace {
  createSession(command: CreateSessionCommand): Promise<SessionResult>;
  cancelSession(command: CancelSessionCommand): Promise<SessionResult>;
  completeSession(command: CompleteSessionCommand): Promise<SessionResult>;
  reassignSession(command: ReassignSessionCommand): Promise<SessionResult>;
}

export interface QueryNamespace {
  getSession(tenantId: TenantId, sessionId: SessionId): Promise<SessionResult>;
  getSessionEvents(
    tenantId: TenantId,
    sessionId: SessionId
  ): Promise<readonly EventResult[]>;
  getSessionReport(
    tenantId: TenantId,
    sessionId: SessionId
  ): Promise<SessionReportResult>;
}

export interface EventNamespace {
  on<T extends MotusEvent["eventName"]>(
    eventPattern: T | string,
    handler: (
      event: Extract<MotusEvent, { readonly eventName: T }> | any
    ) => void | Promise<void>
  ): void;
  off<T extends MotusEvent["eventName"]>(
    eventPattern: T | string,
    handler: (
      event: Extract<MotusEvent, { readonly eventName: T }> | any
    ) => void | Promise<void>
  ): void;
  once<T extends MotusEvent["eventName"]>(
    eventPattern: T | string,
    handler: (
      event: Extract<MotusEvent, { readonly eventName: T }> | any
    ) => void | Promise<void>
  ): void;
}

/**
 * Public public SDK contract interface exposed by the `@motus/sdk` client package.
 */
export interface MotusSDKClient {
  readonly tenant: TenantNamespace;
  readonly driver: DriverNamespace;
  readonly session: SessionNamespace;
  readonly query: QueryNamespace;
  readonly events: EventNamespace;
}
