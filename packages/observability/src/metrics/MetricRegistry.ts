import client, { Counter, Gauge, Histogram, Registry } from "prom-client";

export class MetricRegistry {
  private registry: Registry;
  private metricsMap = new Map<string, any>();

  constructor() {
    this.registry = new Registry();
    // Enable collecting default system metrics (CPU, memory, event loop lag, etc.)
    client.collectDefaultMetrics({
      register: this.registry,
      prefix: "motus_sys_",
    });
  }

  /**
   * Get the underlying prom-client registry.
   */
  public getRegistry(): Registry {
    return this.registry;
  }

  /**
   * Register or retrieve a Counter.
   */
  public counter(config: {
    name: string;
    help: string;
    labelNames?: string[];
  }): Counter<string> {
    const existing = this.metricsMap.get(config.name);
    if (existing) return existing;

    const counter = new Counter({
      name: config.name,
      help: config.help,
      labelNames: config.labelNames || [],
      registers: [this.registry],
    });
    this.metricsMap.set(config.name, counter);
    return counter;
  }

  /**
   * Register or retrieve a Gauge.
   */
  public gauge(config: {
    name: string;
    help: string;
    labelNames?: string[];
  }): Gauge<string> {
    const existing = this.metricsMap.get(config.name);
    if (existing) return existing;

    const gauge = new Gauge({
      name: config.name,
      help: config.help,
      labelNames: config.labelNames || [],
      registers: [this.registry],
    });
    this.metricsMap.set(config.name, gauge);
    return gauge;
  }

  /**
   * Register or retrieve a Histogram.
   */
  public histogram(config: {
    name: string;
    help: string;
    labelNames?: string[];
    buckets?: number[];
  }): Histogram<string> {
    const existing = this.metricsMap.get(config.name);
    if (existing) return existing;

    const histogram = new Histogram({
      name: config.name,
      help: config.help,
      labelNames: config.labelNames || [],
      buckets: config.buckets || [
        0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
      ],
      registers: [this.registry],
    });
    this.metricsMap.set(config.name, histogram);
    return histogram;
  }

  /**
   * Export registered metrics in Prometheus format.
   */
  public async exportMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * Get the Content-Type header value for Prometheus.
   */
  public getContentType(): string {
    return this.registry.contentType;
  }

  /**
   * Reset all metric values.
   */
  public clear(): void {
    this.registry.clear();
    this.metricsMap.clear();
  }
}

// Global default registry
export const defaultRegistry = new MetricRegistry();
export default defaultRegistry;
