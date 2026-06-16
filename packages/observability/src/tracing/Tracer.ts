import {
  trace,
  context as otelContext,
  propagation,
  Span,
  SpanOptions,
  Context,
} from "@opentelemetry/api";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { Resource } from "@opentelemetry/resources";
import { SEMRESATTRS_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { ExporterFactory, ExporterConfig } from "@/exporters/index.js";

export class Tracer {
  private static provider?: NodeTracerProvider;
  private static tracerName = "motus-tracer";

  /**
   * Initialize OpenTelemetry Tracing Provider.
   */
  public static initialize(
    serviceName: string,
    config: ExporterConfig = {}
  ): void {
    if (this.provider) return;

    this.provider = new NodeTracerProvider({
      resource: new Resource({
        [SEMRESATTRS_SERVICE_NAME]: serviceName,
      }),
    });

    const spanProcessor = ExporterFactory.createSpanProcessor(config);
    this.provider.addSpanProcessor(spanProcessor);
    this.provider.register();
  }

  /**
   * Start a new span and returns it.
   */
  public static startSpan(
    name: string,
    options?: SpanOptions,
    context?: Context
  ): Span {
    const tracer = trace.getTracer(this.tracerName);
    return tracer.startSpan(name, options, context);
  }

  /**
   * End a span.
   */
  public static endSpan(span: Span): void {
    if (span && typeof span.end === "function") {
      span.end();
    }
  }

  /**
   * Execute an async or sync function within a span context.
   */
  public static async runWithSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T> | T,
    options?: SpanOptions,
    context?: Context
  ): Promise<T> {
    const tracer = trace.getTracer(this.tracerName);
    const cb = async (span: Span) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: 1 }); // Ok
        return result;
      } catch (error: any) {
        span.recordException(error);
        span.setStatus({
          code: 2, // Error
          message:
            error.message || "Error occurred during runWithSpan execution",
        });
        throw error;
      } finally {
        span.end();
      }
    };

    if (context) {
      return tracer.startActiveSpan(name, options || {}, context, cb);
    }
    return tracer.startActiveSpan(name, options || {}, cb);
  }

  /**
   * Extract trace context from inbound HTTP/WS headers.
   */
  public static extractContext(headers: Record<string, any>): any {
    return propagation.extract(otelContext.active(), headers);
  }

  /**
   * Inject trace context into outbound HTTP/WS headers.
   */
  public static injectContext(headers: Record<string, any>): void {
    propagation.inject(otelContext.active(), headers);
  }

  /**
   * Retrieve the active trace ID.
   */
  public static getTraceId(): string | undefined {
    const spanContext = trace.getSpanContext(otelContext.active());
    return spanContext?.traceId;
  }

  /**
   * Retrieve the active span ID.
   */
  public static getSpanId(): string | undefined {
    const spanContext = trace.getSpanContext(otelContext.active());
    return spanContext?.spanId;
  }
}
