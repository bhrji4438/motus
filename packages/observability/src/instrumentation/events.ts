import { SpanKind } from '@opentelemetry/api';
import { Tracer } from '@/tracing/Tracer.js';
import { ErrorTracker } from '@/errors/ErrorTracker.js';
import { defaultRegistry } from '@/metrics/MetricRegistry.js';

export class EventInstrumenter {
  private static eventDurationHistogram = defaultRegistry.histogram({
    name: 'motus_event_duration_seconds',
    help: 'Processing duration of event bus handlers in seconds',
    labelNames: ['eventName', 'action', 'status'],
  });

  /**
   * Instrument publishing an event on the event bus.
   */
  public static async tracePublish<T>(
    eventName: string,
    publishFn: (carrier: Record<string, any>) => Promise<T> | T,
    eventPayload: Record<string, any> = {}
  ): Promise<T> {
    const spanName = `event publish: ${eventName}`;
    const startTime = process.hrtime();

    return Tracer.runWithSpan(
      spanName,
      async (span) => {
        span.setAttribute('event.name', eventName);
        span.setAttribute('event.action', 'publish');
        if (eventPayload.tenantId) span.setAttribute('tenantId', eventPayload.tenantId);
        if (eventPayload.sessionId) span.setAttribute('sessionId', eventPayload.sessionId);

        // Inject active context
        const carrier: Record<string, any> = {};
        Tracer.injectContext(carrier);

        try {
          const result = await publishFn(carrier);
          this.recordDuration(eventName, 'publish', startTime, 'success');
          return result;
        } catch (error: any) {
          this.recordDuration(eventName, 'publish', startTime, 'error');
          ErrorTracker.captureException(error, `Event publish failed for ${eventName}`, {
            eventName,
            ...eventPayload,
          });
          throw error;
        }
      },
      { kind: SpanKind.PRODUCER }
    );
  }

  /**
   * Instrument handling/subscribing to an event from the event bus.
   */
  public static async traceSubscribe<T>(
    eventName: string,
    carrier: Record<string, any>,
    consumeFn: () => Promise<T> | T,
    eventPayload: Record<string, any> = {}
  ): Promise<T> {
    const spanName = `event handler: ${eventName}`;
    const startTime = process.hrtime();
    const parentContext = Tracer.extractContext(carrier);

    return Tracer.runWithSpan(
      spanName,
      async (span) => {
        span.setAttribute('event.name', eventName);
        span.setAttribute('event.action', 'subscribe');
        if (eventPayload.tenantId) span.setAttribute('tenantId', eventPayload.tenantId);
        if (eventPayload.sessionId) span.setAttribute('sessionId', eventPayload.sessionId);

        try {
          const result = await consumeFn();
          this.recordDuration(eventName, 'subscribe', startTime, 'success');
          return result;
        } catch (error: any) {
          this.recordDuration(eventName, 'subscribe', startTime, 'error');
          ErrorTracker.captureException(error, `Event subscription handler failed for ${eventName}`, {
            eventName,
            ...eventPayload,
          });
          throw error;
        }
      },
      { kind: SpanKind.CONSUMER },
      parentContext
    );
  }

  private static recordDuration(
    eventName: string,
    action: 'publish' | 'subscribe',
    startTime: [number, number],
    status: string
  ): void {
    const diff = process.hrtime(startTime);
    const durationSec = diff[0] + diff[1] / 1e9;
    this.eventDurationHistogram.observe(
      {
        eventName,
        action,
        status,
      },
      durationSec
    );
  }
}
