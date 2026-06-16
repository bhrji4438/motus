import { IMetricsCollector } from "@motus/core";
import { MetricRegistry, defaultRegistry } from "@/metrics/MetricRegistry.js";

export class MetricsCollector implements IMetricsCollector {
  private registry: MetricRegistry;

  // Metric definitions
  private matchingLatencyHistogram;
  private fanoutDurationHistogram;
  private assignmentSuccessCounter;
  private assignmentTimeoutCounter;
  private staleDetectionCounter;
  private driverLostCounter;

  constructor(registry: MetricRegistry = defaultRegistry) {
    this.registry = registry;

    this.matchingLatencyHistogram = this.registry.histogram({
      name: "motus_matching_latency_seconds",
      help: "Duration of the candidate matching wave process in seconds",
      labelNames: ["tenantId"],
    });

    this.fanoutDurationHistogram = this.registry.histogram({
      name: "motus_fanout_duration_seconds",
      help: "Duration of the dispatch wave notification fanout in seconds",
      labelNames: ["tenantId"],
    });

    this.assignmentSuccessCounter = this.registry.counter({
      name: "motus_assignment_success_total",
      help: "Total number of successfully accepted assignments",
      labelNames: ["tenantId"],
    });

    this.assignmentTimeoutCounter = this.registry.counter({
      name: "motus_assignment_timeout_total",
      help: "Total number of expired/timed-out wave assignments",
      labelNames: ["tenantId"],
    });

    this.staleDetectionCounter = this.registry.counter({
      name: "motus_stale_detection_total",
      help: "Total count of stale driver presence detections",
      labelNames: ["tenantId"],
    });

    this.driverLostCounter = this.registry.counter({
      name: "motus_driver_lost_total",
      help: "Total count of drivers transitioning to lost status",
      labelNames: ["tenantId"],
    });
  }

  public recordMatchingLatency(tenantId: string, durationMs: number): void {
    this.matchingLatencyHistogram.observe({ tenantId }, durationMs / 1000);
  }

  public recordFanoutDuration(tenantId: string, durationMs: number): void {
    this.fanoutDurationHistogram.observe({ tenantId }, durationMs / 1000);
  }

  public incrementAssignmentSuccess(tenantId: string): void {
    this.assignmentSuccessCounter.inc({ tenantId });
  }

  public incrementAssignmentTimeout(tenantId: string): void {
    this.assignmentTimeoutCounter.inc({ tenantId });
  }

  public incrementStaleDetection(tenantId: string): void {
    this.staleDetectionCounter.inc({ tenantId });
  }

  public incrementDriverLost(tenantId: string): void {
    this.driverLostCounter.inc({ tenantId });
  }
}
