export interface IMetricsCollector {
  recordMatchingLatency(tenantId: string, durationMs: number): void;
  recordFanoutDuration(tenantId: string, durationMs: number): void;
  incrementAssignmentSuccess(tenantId: string): void;
  incrementAssignmentTimeout(tenantId: string): void;
  incrementStaleDetection(tenantId: string): void;
  incrementDriverLost(tenantId: string): void;
}

export interface ITracer {
  startSpan(name: string): any;
  endSpan(span: any): void;
}
