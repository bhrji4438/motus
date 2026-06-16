import { ILogger, ITracer } from '@motus/core';
import { ISocketMetrics, NoopSocketMetrics } from '@/observability/ISocketMetrics.js';

export interface SocketObservabilityDeps {
  logger?: ILogger;
  metrics?: ISocketMetrics;
  tracer?: ITracer;
}

export class MetricsManager {
  public readonly logger: ILogger;
  public readonly metrics: ISocketMetrics;
  public readonly tracer: ITracer;

  constructor(deps?: SocketObservabilityDeps) {
    this.logger = deps?.logger ?? {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };
    this.metrics = deps?.metrics ?? new NoopSocketMetrics();
    this.tracer = deps?.tracer ?? {
      startSpan: () => null,
      endSpan: () => {},
    };
  }

  public trackLatency<T>(spanName: string, operation: () => T): T {
    const span = this.tracer.startSpan(spanName);
    const start = Date.now();
    try {
      const result = operation();
      if (result instanceof Promise) {
        return (result as any).then((res: any) => {
          this.metrics.recordDeliveryLatency(spanName, Date.now() - start);
          this.tracer.endSpan(span);
          return res;
        }).catch((err: any) => {
          this.logger.error(`Error in operational span: ${spanName}`, err);
          this.tracer.endSpan(span);
          throw err;
        }) as any;
      }
      this.metrics.recordDeliveryLatency(spanName, Date.now() - start);
      this.tracer.endSpan(span);
      return result;
    } catch (err) {
      this.logger.error(`Error in operational span: ${spanName}`, err);
      this.tracer.endSpan(span);
      throw err;
    }
  }
}
