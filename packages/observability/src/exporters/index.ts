import { SpanExporter, SimpleSpanProcessor, BatchSpanProcessor, SpanProcessor } from '@opentelemetry/sdk-trace-base';
import { ConsoleSpanExporter, InMemorySpanExporter } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { MetricReader, PeriodicExportingMetricReader, ConsoleMetricExporter } from '@opentelemetry/sdk-metrics';

export interface ExporterConfig {
  tracesExporter?: 'console' | 'memory' | 'otlp' | 'noop';
  metricsExporter?: 'console' | 'prometheus' | 'noop';
  otlpEndpoint?: string;
}

export class ExporterFactory {
  private static inMemorySpanExporter?: InMemorySpanExporter;

  /**
   * Get the active in-memory span exporter (for testing assertions).
   */
  public static getInMemorySpanExporter(): InMemorySpanExporter {
    if (!this.inMemorySpanExporter) {
      this.inMemorySpanExporter = new InMemorySpanExporter();
    }
    return this.inMemorySpanExporter;
  }

  /**
   * Create an OpenTelemetry SpanProcessor based on the exporter configuration.
   */
  public static createSpanProcessor(config: ExporterConfig): SpanProcessor {
    let exporter: SpanExporter;

    switch (config.tracesExporter) {
      case 'memory':
        exporter = this.getInMemorySpanExporter();
        break;
      case 'otlp':
        exporter = new OTLPTraceExporter({
          url: config.otlpEndpoint || 'http://localhost:4318/v1/traces',
        });
        break;
      case 'console':
      default:
        exporter = new ConsoleSpanExporter();
        break;
    }

    // Use SimpleSpanProcessor for dev/testing, BatchSpanProcessor for production/OTLP
    if (config.tracesExporter === 'otlp') {
      return new BatchSpanProcessor(exporter);
    }
    return new SimpleSpanProcessor(exporter);
  }

  /**
   * Create an OpenTelemetry MetricReader based on the configuration.
   */
  public static createMetricReader(config: ExporterConfig): MetricReader | undefined {
    switch (config.metricsExporter) {
      case 'console':
        return new PeriodicExportingMetricReader({
          exporter: new ConsoleMetricExporter(),
          exportIntervalMillis: 60000,
        });
      case 'noop':
        return undefined;
      default:
        // By default, we let prom-client registry serialize metrics for Prometheus pulls,
        // so we don't need a push-based OTel metric reader.
        return undefined;
    }
  }
}
