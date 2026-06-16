# @motus/observability

Logging, metrics collection, tracing, and health check diagnostics.

---

## 1. Purpose

Provides OpenTelemetry spans, metrics, log correlations, diagnostics, and hooks to monitor the Motus platform in production.

---

## 2. Installation

```bash
npm install @motus/observability
```

---

## 3. Quick Start

```typescript
import { logger } from "@motus/observability";

logger.info("Starting Motus application...");
```

---

## 4. Configuration

Exposes logging levels (`LOG_LEVEL=info`) and exporters (`ExporterConfig`). Hooks into Fastify and Express servers using middleware wrappers.

---

## 5. Common Use Cases

- Tracing transactions across microservices using correlation contexts.
- Tracking API request counts and latency counters.
- Registering and checking database health diagnostics.
- Logging structured warnings and errors.

---

## 6. API Reference Link

- [API Reference: @motus/observability](../../docs/api-reference/observability.md)

---

## 7. Related Modules

- `@motus/core` — Domain handlers and managers instrumentation.
- `@motus/types` — Metric config variables.

---

## 8. Production Notes

Configure trace sampling configurations in production environments to limit performance overhead.

---

## 9. Limitations

Metrics are cached locally in-memory; Prometheus engines must query the scrape endpoints to aggregate cluster-wide metrics.

---

## 10. Examples

Detailed examples for registering custom health probes can be found in the [Observability Module Page](../../docs/modules/observability.md).
