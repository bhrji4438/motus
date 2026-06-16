export { Motus } from "@/public/Motus.js";
export { TenantNamespace } from "@/public/TenantNamespace.js";
export { DriverNamespace } from "@/public/DriverNamespace.js";
export { SessionNamespace } from "@/public/SessionNamespace.js";
export { QueryNamespace } from "@/public/QueryNamespace.js";
export { EventNamespace } from "@/public/EventNamespace.js";
export { ConfigurationManager } from "@/public/config/ConfigurationManager.js";
export {
  MotusCoreError,
  ErrorFactory,
} from "@/internal/errors/ErrorFactory.js";
export { isErrorCodeRetryable } from "@/internal/errors/Retryability.js";
export {
  HTTP_CODE_MAP,
  WEBSOCKET_CODE_MAP,
} from "@/internal/errors/ErrorCodes.js";
export { EventDispatcher } from "@/internal/events/EventDispatcher.js";

// Re-export standard model interfaces, enums, errors from @motus/types
export * from "@motus/types";
export * from "@/internal/interfaces/ports.js";
export * from "@/internal/observability/observability.js";

// Export internal managers, services, and workers for the facade package
export { TenantManager } from "@/internal/managers/TenantManager.js";
export { DriverManager } from "@/internal/managers/DriverManager.js";
export { SessionManager } from "@/internal/managers/SessionManager.js";
export { TrackingManager } from "@/internal/managers/TrackingManager.js";
export { AssignmentManager } from "@/internal/managers/AssignmentManager.js";
export { FanoutEngine } from "@/internal/services/fanout/FanoutEngine.js";
export { MatchingEngine } from "@/internal/services/matching/MatchingEngine.js";
export { DriverStaleDetector } from "@/internal/workers/presence/DriverStaleDetector.js";
export { DriverLostMonitor } from "@/internal/workers/presence/DriverLostMonitor.js";
export { RetryWorker } from "@/internal/workers/retry/RetryWorker.js";
export { FanoutTimeoutWorker } from "@/internal/workers/fanout/FanoutTimeoutWorker.js";
export { CleanupWorker } from "@/internal/workers/cleanup/CleanupWorker.js";

