import { SpanKind } from '@opentelemetry/api';
import { Tracer } from '@/tracing/Tracer.js';
import { ErrorTracker } from '@/errors/ErrorTracker.js';
import { defaultRegistry } from '@/metrics/MetricRegistry.js';

export interface DatabaseTelemetryOptions {
  dbSystem: string; // e.g. 'redis', 'postgresql'
  dbName?: string;
  tenantId?: string;
}

export class DatabaseInstrumenter {
  private dbSystem: string;
  private dbName: string | undefined;
  private latencyHistogram;

  constructor(options: DatabaseTelemetryOptions) {
    this.dbSystem = options.dbSystem;
    this.dbName = options.dbName;
    this.latencyHistogram = defaultRegistry.histogram({
      name: `motus_db_${this.dbSystem}_duration_seconds`,
      help: `Duration of ${this.dbSystem} operations in seconds`,
      labelNames: ['operation', 'dbName', 'status'],
    });
  }

  /**
   * Instrument a database operation callback.
   */
  public async traceCall<T>(
    operation: string,
    queryFn: () => Promise<T>,
    metadata: Record<string, any> = {}
  ): Promise<T> {
    const spanName = `${this.dbSystem}.${operation}`;
    const startTime = process.hrtime();

    return Tracer.runWithSpan(
      spanName,
      async (span) => {
        span.setAttribute('db.system', this.dbSystem);
        if (this.dbName) span.setAttribute('db.name', this.dbName);
        span.setAttribute('db.operation', operation);
        
        Object.entries(metadata).forEach(([key, val]) => {
          span.setAttribute(`db.metadata.${key}`, String(val));
        });

        try {
          const result = await queryFn();
          this.recordDuration(operation, startTime, 'success');
          return result;
        } catch (error: any) {
          this.recordDuration(operation, startTime, 'error');
          ErrorTracker.captureException(error, `Database operation ${operation} failed`, {
            dbSystem: this.dbSystem,
            dbName: this.dbName,
            operation,
            ...metadata,
          });
          throw error;
        }
      },
      { kind: SpanKind.CLIENT }
    );
  }

  private recordDuration(operation: string, startTime: [number, number], status: string): void {
    const diff = process.hrtime(startTime);
    const durationSec = diff[0] + diff[1] / 1e9;
    this.latencyHistogram.observe(
      {
        operation,
        dbName: this.dbName || 'unknown',
        status,
      },
      durationSec
    );
  }
}
