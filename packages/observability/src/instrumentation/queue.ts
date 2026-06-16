import { SpanKind } from "@opentelemetry/api";
import { Tracer } from "@/tracing/Tracer.js";
import { ErrorTracker } from "@/errors/ErrorTracker.js";
import { defaultRegistry } from "@/metrics/MetricRegistry.js";

export interface QueueTelemetryOptions {
  queueSystem: string; // e.g. 'redis-streams', 'bullmq'
}

export class QueueInstrumenter {
  private queueSystem: string;
  private queueDurationHistogram;

  constructor(options: QueueTelemetryOptions) {
    this.queueSystem = options.queueSystem;
    this.queueDurationHistogram = defaultRegistry.histogram({
      name: `motus_queue_${this.queueSystem}_duration_seconds`,
      help: `Processing duration of queue jobs in seconds`,
      labelNames: ["queue", "jobType", "action", "status"],
    });
  }

  /**
   * Instrument pushing a message/job onto a queue.
   */
  public async tracePublish<T>(
    queueName: string,
    jobType: string,
    publishFn: (carrier: Record<string, any>) => Promise<T>,
    metadata: Record<string, any> = {}
  ): Promise<T> {
    const spanName = `${queueName} publish`;
    const startTime = process.hrtime();

    return Tracer.runWithSpan(
      spanName,
      async (span) => {
        span.setAttribute("messaging.system", this.queueSystem);
        span.setAttribute("messaging.destination", queueName);
        span.setAttribute("messaging.operation", "publish");
        span.setAttribute("messaging.job.type", jobType);

        // Inject tracing context to the carrier headers
        const carrier: Record<string, any> = {};
        Tracer.injectContext(carrier);

        Object.entries(metadata).forEach(([key, val]) => {
          span.setAttribute(`messaging.metadata.${key}`, String(val));
        });

        try {
          const result = await publishFn(carrier);
          this.recordDuration(
            queueName,
            jobType,
            "publish",
            startTime,
            "success"
          );
          return result;
        } catch (error: any) {
          this.recordDuration(
            queueName,
            jobType,
            "publish",
            startTime,
            "error"
          );
          ErrorTracker.captureException(
            error,
            `Failed to publish job to queue ${queueName}`,
            {
              queueSystem: this.queueSystem,
              queueName,
              jobType,
              ...metadata,
            }
          );
          throw error;
        }
      },
      { kind: SpanKind.PRODUCER }
    );
  }

  /**
   * Instrument consuming/processing a message/job from a queue.
   */
  public async traceConsume<T>(
    queueName: string,
    jobType: string,
    carrier: Record<string, any>,
    consumeFn: () => Promise<T>
  ): Promise<T> {
    const spanName = `${queueName} process`;
    const startTime = process.hrtime();

    // Extract trace context from carrier headers
    const parentContext = Tracer.extractContext(carrier);

    return Tracer.runWithSpan(
      spanName,
      async (span) => {
        span.setAttribute("messaging.system", this.queueSystem);
        span.setAttribute("messaging.destination", queueName);
        span.setAttribute("messaging.operation", "process");
        span.setAttribute("messaging.job.type", jobType);

        try {
          const result = await consumeFn();
          this.recordDuration(
            queueName,
            jobType,
            "process",
            startTime,
            "success"
          );
          return result;
        } catch (error: any) {
          this.recordDuration(
            queueName,
            jobType,
            "process",
            startTime,
            "error"
          );
          ErrorTracker.captureException(
            error,
            `Failed to process job in queue ${queueName}`,
            {
              queueSystem: this.queueSystem,
              queueName,
              jobType,
            }
          );
          throw error;
        }
      },
      { kind: SpanKind.CONSUMER },
      parentContext
    );
  }

  private recordDuration(
    queue: string,
    jobType: string,
    action: "publish" | "process",
    startTime: [number, number],
    status: string
  ): void {
    const diff = process.hrtime(startTime);
    const durationSec = diff[0] + diff[1] / 1e9;
    this.queueDurationHistogram.observe(
      {
        queue,
        jobType,
        action,
        status,
      },
      durationSec
    );
  }
}
