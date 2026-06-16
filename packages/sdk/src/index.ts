// ─── Vectro SDK Facade & Configuration ──────────────────────────────────────
export { createVectro } from "./factory.js";
export type { VectroInstance } from "./factory.js";
export type { VectroConfig } from "./config.js";

// ─── Explicit Re-Exports from @motus/core ──────────────────────────────────
export {
  Motus,
  TenantNamespace,
  DriverNamespace,
  SessionNamespace,
  QueryNamespace,
  EventNamespace,
  MotusCoreError,
} from "@motus/core";

// ─── Explicit Re-Exports from @motus/types ──────────────────────────────────

// 1. Value Objects
export type {
  TenantId,
  DriverId,
  SessionId,
  ZoneId,
  Coordinates,
  Distance,
  Duration,
  Radius,
  ETA,
  VehicleType,
  Status,
  TenantScoped,
} from "@motus/types";

// 2. Enums
export {
  DriverStatus,
  SessionState,
  MatchingStrategy,
  TelemetryProfile,
  DispatchWaveStatus,
  DriverLostReason,
  ErrorCode,
} from "@motus/types";

// 3. Domain Commands
export type {
  RegisterTenantCommand,
  UpdateTenantCommand,
  RegisterDriverCommand,
  UpdateDriverCommand,
  UpdateDriverLocationCommand,
  CreateSessionCommand,
  CancelSessionCommand,
  CompleteSessionCommand,
  ReassignSessionCommand,
} from "@motus/types";

// 4. Domain Results
export type {
  TenantResult,
  DriverResult,
  SessionResult,
  SessionReportResult,
  EventResult,
} from "@motus/types";

// 5. Domain Models
export type {
  Tenant,
  Driver,
  Session,
  TelemetryPoint,
  DispatchWave,
  Assignment,
  Zone,
  MotusEvent,
} from "@motus/types";

// ─── Explicit Re-Exports from @motus/socketio ──────────────────────────────
export {
  SocketServer,
} from "@motus/socketio";
export type {
  SocketIOConfig,
} from "@motus/socketio";

// ─── Explicit Re-Exports from @motus/observability ─────────────────────────
export {
  Logger,
  logger,
} from "@motus/observability";
