# API Reference - @motus/observability

This document details the tracking, metrics, tracing, diagnostics, and hooks of the `@motus/observability` package.

---

## 1. Class: CorrelationContext

Provides AsyncLocalStorage scopes to propagate correlation IDs across network boundaries.

```typescript
export class CorrelationContext {
  public static run<T>(correlationId: string, fn: () => Promise<T>): Promise<T>;
  public static getCorrelationId(): string | undefined;
}
```

---

## 2. Class: Logger

Structured console and export logger that auto-injects active correlation IDs.

```typescript
export class Logger {
  public info(message: string, context?: Record<string, any>): void;
  public warn(message: string, context?: Record<string, any>): void;
  public error(
    message: string,
    error?: Error,
    context?: Record<string, any>
  ): void;
}
```

---

## 3. Class: MetricRegistry

OpenTelemetry-compatible gauge and counter accumulator.

```typescript
export class MetricRegistry {
  public counter(options: MetricOptions): Counter;
  public gauge(options: MetricOptions): Gauge;
  public histogram(options: MetricOptions): Histogram;
  public getPrometheusMetrics(): Promise<string>;
}
```

---

## 4. Class: HealthCheckRegistry

Manages diagnostic probes.

```typescript
export class HealthCheckRegistry {
  public register(name: string, checkFn: HealthCheckFn): void;
  public runChecks(): Promise<HealthCheckResult[]>;
}

type HealthCheckFn = () => Promise<HealthCheckResult>;
```

---

## 5. Instrumentation Hooks

Automatic middleware interceptors:

- `registerFastifyHooks(fastifyInstance)`: Integrates Fastify servers.
- `expressMiddleware(req, res, next)`: Integrates Express servers.
- `DatabaseInstrumenter`: Instruments Redis connection timings.
- `QueueInstrumenter`: Track Redis streams lags.
- `EventInstrumenter`: Counts system domain events.
