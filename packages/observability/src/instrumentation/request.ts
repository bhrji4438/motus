import { SpanKind, Span } from "@opentelemetry/api";
import { Tracer } from "@/tracing/Tracer.js";
import { CorrelationContext } from "@/logger/CorrelationContext.js";
import { logger } from "@/logger/Logger.js";
import { defaultRegistry } from "@/metrics/MetricRegistry.js";

// Setup request metrics
const requestCounter = defaultRegistry.counter({
  name: "motus_api_requests_total",
  help: "Total number of HTTP requests processed",
  labelNames: ["method", "route", "statusCode"],
});

const requestDurationHistogram = defaultRegistry.histogram({
  name: "motus_api_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "statusCode"],
});

/**
 * Fastify Request Instrumentation Hook Register
 */
export function registerFastifyHooks(fastifyInstance: any): void {
  // 1. onRequest Hook: Bind Correlation ID and start trace span
  fastifyInstance.addHook("onRequest", async (request: any, reply: any) => {
    const correlationId =
      request.headers["x-correlation-id"] ||
      request.headers["X-Correlation-ID"] ||
      CorrelationContext.generateId();

    request.correlationId = correlationId;
    reply.header("X-Correlation-ID", correlationId);

    const tenantId = request.params?.tenantId || request.query?.tenantId;
    const sessionId = request.params?.sessionId || request.query?.sessionId;

    // We store the active trace/span reference on the request object for cleanup in onResponse
    const carrier = request.headers;
    const parentContext = Tracer.extractContext(carrier);

    const span = Tracer.startSpan(
      `${request.method} ${request.routerPath || request.url}`,
      {
        kind: SpanKind.SERVER,
      },
      parentContext
    );

    span.setAttribute("http.method", request.method);
    span.setAttribute("http.url", request.url);
    if (tenantId) span.setAttribute("tenantId", tenantId);
    if (sessionId) span.setAttribute("sessionId", sessionId);

    request.otelSpan = span;
    request.startTime = process.hrtime();

    // Start AsyncLocalStorage context boundary
    return new Promise<void>((resolve) => {
      CorrelationContext.run({ correlationId, tenantId, sessionId }, () => {
        logger.info(`Incoming HTTP Request: ${request.method} ${request.url}`);
        resolve();
      });
    });
  });

  // 2. onResponse Hook: Record duration and end span
  fastifyInstance.addHook("onResponse", async (request: any, reply: any) => {
    const span = request.otelSpan as Span;
    const startTime = request.startTime as [number, number];
    const statusCode = reply.statusCode.toString();
    const route = request.routerPath || "unknown";

    if (startTime) {
      const diff = process.hrtime(startTime);
      const durationSec = diff[0] + diff[1] / 1e9;

      requestDurationHistogram.observe(
        { method: request.method, route, statusCode },
        durationSec
      );
      requestCounter.inc({ method: request.method, route, statusCode });

      logger.info(
        `HTTP Request Complete: ${request.method} ${
          request.url
        } - Status ${statusCode} - ${durationSec.toFixed(3)}s`
      );
    }

    if (span) {
      span.setAttribute("http.status_code", reply.statusCode);
      Tracer.endSpan(span);
    }
  });

  // 3. onError Hook: Capture exception in trace
  fastifyInstance.addHook(
    "onError",
    async (request: any, _reply: any, error: Error) => {
      const span = request.otelSpan as Span;
      if (span) {
        span.recordException(error);
        span.setStatus({ code: 2, message: error.message });
      }
      logger.error(
        `HTTP Request Error: ${request.method} ${request.url}`,
        error
      );
    }
  );
}

/**
 * Standard Express Middleware for Request Instrumentation
 */
export function expressMiddleware() {
  return (req: any, res: any, next: () => void) => {
    const correlationId =
      req.headers["x-correlation-id"] ||
      req.headers["X-Correlation-ID"] ||
      CorrelationContext.generateId();

    req.correlationId = correlationId;
    res.setHeader("X-Correlation-ID", correlationId);

    const tenantId = req.params?.tenantId || req.query?.tenantId;
    const sessionId = req.params?.sessionId || req.query?.sessionId;

    const parentContext = Tracer.extractContext(req.headers);
    const span = Tracer.startSpan(
      `${req.method} ${req.route?.path || req.url}`,
      {
        kind: SpanKind.SERVER,
      },
      parentContext
    );

    span.setAttribute("http.method", req.method);
    span.setAttribute("http.url", req.url);
    if (tenantId) span.setAttribute("tenantId", tenantId);
    if (sessionId) span.setAttribute("sessionId", sessionId);

    const startTime = process.hrtime();

    res.on("finish", () => {
      const statusCode = res.statusCode.toString();
      const route = req.route?.path || "unknown";
      const diff = process.hrtime(startTime);
      const durationSec = diff[0] + diff[1] / 1e9;

      requestDurationHistogram.observe(
        { method: req.method, route, statusCode },
        durationSec
      );
      requestCounter.inc({ method: req.method, route, statusCode });

      logger.info(
        `HTTP Request Complete: ${req.method} ${
          req.url
        } - Status ${statusCode} - ${durationSec.toFixed(3)}s`
      );

      span.setAttribute("http.status_code", res.statusCode);
      Tracer.endSpan(span);
    });

    CorrelationContext.run({ correlationId, tenantId, sessionId }, () => {
      logger.info(`Incoming HTTP Request: ${req.method} ${req.url}`);
      next();
    });
  };
}
