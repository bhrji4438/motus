# @motus/observability

Production-grade observability infrastructure package for the Motus platform. Provides OpenTelemetry integrations, structured logging, Prometheus metrics, diagnostics, error tracking, and request/resource lifecycle instrumentation.

## Features

- **OpenTelemetry Distributed Tracing**: Track execution scopes across service and network barriers (conforming to W3C `traceparent` context propagation).
- **Structured JSON Logging**: Wraps `pino` with automatic context inheritance (correlation ID, tenant context, and session ID) via `AsyncLocalStorage`.
- **Prometheus Metrics**: Register and export performance indicators (counters, gauges, histograms) using a custom `MetricRegistry`.
- **Error Tracking**: Global hooks to attach exception logs, inject tracing tags, and execute third-party captures (e.g. Sentry/Rollbar).
- **Generic Resource Instrumentation**: Adapter-based wrappers to trace database calls (`database.ts`), queues/streams (`queue.ts`), and local events (`events.ts`).
- **HTTP Lifecycle Instrumentation**: Built-in middleware for Fastify and Express to parse correlation headers and trace server request durations.
- **Diagnostics**: Health Check registry verifying memory/CPU metrics and downstream resource availability.

## Usage

### 1. Initialization
```typescript
import { Tracer } from '@motus/observability';

Tracer.initialize('my-service', {
  tracesExporter: 'otlp',
  metricsExporter: 'prometheus',
  otlpEndpoint: 'http://collector:4318/v1/traces'
});
```

### 2. Structured Context Logging
```typescript
import { logger, CorrelationContext } from '@motus/observability';

// Correlation ID is propagated automatically
CorrelationContext.run({ correlationId: 'req-123', tenantId: 'tenant-usa' }, () => {
  logger.info('Processing driver matching request');
  // Logs: {"level":"INFO","time":"...","correlationId":"req-123","tenantId":"tenant-usa","msg":"Processing..."}
});
```

### 3. Database Operation Tracing
```typescript
import { DatabaseInstrumenter } from '@motus/observability';

const dbTelemetry = new DatabaseInstrumenter({ dbSystem: 'redis', dbName: 'presence-store' });

const value = await dbTelemetry.traceCall('getDriverState', async () => {
  return redisClient.get('driver-101');
});
```
