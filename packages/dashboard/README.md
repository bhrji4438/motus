# @motus/dashboard

Operational telemetry, dashboard server, and real-time dashboard UI for the Vectro platform.

---

## 1. Purpose

Provides REST APIs, Server-Sent Events (SSE) streams, and a React-based visual frontend to monitor drivers, sessions, active queues, and telemetry logs in real time.

---

## 2. Installation

```bash
npm install @motus/dashboard
```

---

## 3. Quick Start

```typescript
import { FastifyInstance } from "fastify";
import { dashboardPlugin } from "@motus/dashboard";

// Mount plugin on your Fastify server instance
fastify.register(dashboardPlugin);
```

---

## 4. Configuration

Requires environment authentication configuration flags and role permissions parameters. Define endpoints inside standard web client settings.

---

## 5. Common Use Cases

- Displaying active drivers on a live map widget.
- Inspecting active session telemetry histories.
- Monitoring system queues and latency rates.
- Exporting tenant audit logs to CSV format.

---

## 6. API Reference Link

- [API Reference: @motus/core](../../docs/api-reference/core.md)

---

## 7. Related Modules

- `@motus/core` — Domain handlers and manager facades.
- `@motus/observability` — Diagnostic logs.

---

## 8. Production Notes

Enable administrative authorization middlewares and enforce strict HTTPS/WSS requirements when deploying the dashboard plugin in production.

---

## 9. Limitations

Designed primarily for operational diagnostics and monitoring; it does not replace external analytics databases (such as Snowflake or BigQuery) for long-term storage or reports.

---

## 10. Examples

Detailed route endpoints and SSE specifications can be found in the [Audit Logging Module Page](../../docs/modules/audit-logging.md).
