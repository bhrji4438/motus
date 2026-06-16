import type { ILogger, IMetricsCollector, ITracer } from "@motus/core";

/**
 * Extended Redis-specific metrics interface covering all infrastructure operations.
 */
export interface IRedisMetrics extends IMetricsCollector {
  recordCommandLatency(command: string, durationMs: number): void;
  incrementCacheHit(repository: string): void;
  incrementCacheMiss(repository: string): void;
  recordGeoQueryResults(tenantId: string, count: number): void;
  incrementLockContention(lockKey: string): void;
  incrementLockAcquisition(lockKey: string): void;
  incrementStreamAppend(streamType: "event" | "telemetry"): void;
  recordCleanupPruned(
    type: "session" | "telemetry" | "event",
    count: number
  ): void;
  recordPubSubPublish(channel: string): void;
  recordPubSubReceived(channel: string): void;
}

/** No-op metrics collector — used when no metrics provider is injected. */
export class NoopMetrics implements IRedisMetrics {
  recordMatchingLatency(_tenantId: string, _durationMs: number): void {}
  recordFanoutDuration(_tenantId: string, _durationMs: number): void {}
  incrementAssignmentSuccess(_tenantId: string): void {}
  incrementAssignmentTimeout(_tenantId: string): void {}
  incrementStaleDetection(_tenantId: string): void {}
  incrementDriverLost(_tenantId: string): void {}
  recordCommandLatency(_command: string, _durationMs: number): void {}
  incrementCacheHit(_repository: string): void {}
  incrementCacheMiss(_repository: string): void {}
  recordGeoQueryResults(_tenantId: string, _count: number): void {}
  incrementLockContention(_lockKey: string): void {}
  incrementLockAcquisition(_lockKey: string): void {}
  incrementStreamAppend(_streamType: "event" | "telemetry"): void {}
  recordCleanupPruned(
    _type: "session" | "telemetry" | "event",
    _count: number
  ): void {}
  recordPubSubPublish(_channel: string): void {}
  recordPubSubReceived(_channel: string): void {}
}

/** No-op tracer — used when no tracer is injected. */
export class NoopTracer implements ITracer {
  startSpan(_name: string): null {
    return null;
  }
  endSpan(_span: null): void {}
}

/** No-op logger — used when no logger is injected. */
export class NoopLogger implements ILogger {
  debug(_message: string, ..._args: unknown[]): void {}
  info(_message: string, ..._args: unknown[]): void {}
  warn(_message: string, ..._args: unknown[]): void {}
  error(_message: string, ..._args: unknown[]): void {}
}

/**
 * Container for all observability dependencies.
 * Defaults to no-op implementations when not provided.
 */
export interface RedisObservabilityDeps {
  logger?: ILogger;
  metrics?: IRedisMetrics;
  tracer?: ITracer;
  slowCommandThresholdMs?: number;
}

/**
 * Resolved observability with guaranteed non-null implementations.
 */
export interface ResolvedObservability {
  logger: ILogger;
  metrics: IRedisMetrics;
  tracer: ITracer;
  slowCommandThresholdMs: number;
}

export function resolveObservability(
  deps?: RedisObservabilityDeps
): ResolvedObservability {
  return {
    logger: deps?.logger ?? new NoopLogger(),
    metrics: deps?.metrics ?? new NoopMetrics(),
    tracer: deps?.tracer ?? new NoopTracer(),
    slowCommandThresholdMs: deps?.slowCommandThresholdMs ?? 100,
  };
}

/**
 * Executes an async operation with timing and tracing.
 * Logs a warning if the operation exceeds the slow command threshold.
 */
export async function withObservability<T>(
  obs: ResolvedObservability,
  spanName: string,
  operation: () => Promise<T>
): Promise<T> {
  const span = obs.tracer.startSpan(spanName);
  const start = Date.now();
  try {
    const result = await operation();
    const durationMs = Date.now() - start;
    obs.metrics.recordCommandLatency(spanName, durationMs);
    if (durationMs > obs.slowCommandThresholdMs) {
      obs.logger.warn(`Slow Redis operation: ${spanName} took ${durationMs}ms`);
    }
    return result;
  } catch (err) {
    const durationMs = Date.now() - start;
    obs.logger.error(
      `Redis operation failed: ${spanName} after ${durationMs}ms`,
      err
    );
    throw err;
  } finally {
    obs.tracer.endSpan(span);
  }
}
