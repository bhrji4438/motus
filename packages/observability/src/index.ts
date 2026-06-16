// Log and Context exports
export {
  CorrelationContext,
  ICorrelationContext,
} from "@/logger/CorrelationContext.js";
export { Logger, logger, default as defaultLogger } from "@/logger/Logger.js";

// Metrics exports
export { MetricRegistry, defaultRegistry } from "@/metrics/MetricRegistry.js";
export { MetricsCollector } from "@/metrics/MetricsCollector.js";

// Tracing and exporters exports
export { Tracer } from "@/tracing/Tracer.js";
export { ExporterFactory, ExporterConfig } from "@/exporters/index.js";

// Error tracking exports
export { ErrorTracker, ErrorHook } from "@/errors/ErrorTracker.js";

// Instrumentation hooks
export {
  DatabaseInstrumenter,
  DatabaseTelemetryOptions,
} from "@/instrumentation/database.js";
export {
  QueueInstrumenter,
  QueueTelemetryOptions,
} from "@/instrumentation/queue.js";
export { EventInstrumenter } from "@/instrumentation/events.js";
export {
  registerFastifyHooks,
  expressMiddleware,
} from "@/instrumentation/request.js";

// Health and Diagnostics exports
export {
  HealthCheckRegistry,
  defaultHealthRegistry,
  HealthStatus,
  HealthCheckResult,
  HealthCheckFn,
} from "@/diagnostics/HealthCheck.js";
