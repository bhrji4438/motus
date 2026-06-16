# API Reference - @motus/observability

This document details the tracking, metrics, tracing, diagnostics, and hooks of the `@motus/observability` package.

---

## 1. Class: CorrelationContext

Provides AsyncLocalStorage scopes to propagate correlation IDs across network boundaries.

```typescript
export class CorrelationContext {
  public static run<T>(
    context: { correlationId: string; tenantId?: string },
    fn: () => Promise<T>
  ): Promise<T>;
  public static getCorrelationId(): string | undefined;
  public static getTenantId(): string | undefined;
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
    error?: Error | unknown,
    context?: Record<string, any>
  ): void;
}
```

---

## 3. Class: HealthCheckRegistry

Manages diagnostic probes.

```typescript
export class HealthCheckRegistry {
  public register(name: string, checkFn: () => Promise<HealthCheckResult>): void;
  public evaluate(): Promise<{ status: "UP" | "DOWN"; details: Record<string, any> }>;
}

interface HealthCheckResult {
  status: "UP" | "DOWN";
  details: Record<string, any>;
  timestamp: string;
}
```

---

## 4. Instrumentation Hooks

Automatic middleware interceptors:

- `DatabaseInstrumenter`: Instruments Redis/database connection timings.
- `EventInstrumenter`: Counts system domain events and latency.
