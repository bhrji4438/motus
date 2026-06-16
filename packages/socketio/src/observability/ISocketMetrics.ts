import { IMetricsCollector } from "@motus/core";

export interface ISocketMetrics extends IMetricsCollector {
  recordActiveConnection(
    tenantId: string,
    type: "driver" | "consumer",
    count: number
  ): void;
  recordHeartbeat(tenantId: string, driverId: string): void;
  recordSubscription(
    tenantId: string,
    roomType: "tenant" | "driver" | "session" | "tracking"
  ): void;
  recordUnsubscription(
    tenantId: string,
    roomType: "tenant" | "driver" | "session" | "tracking"
  ): void;
  recordMessageSent(event: string, sizeBytes: number): void;
  recordMessageReceived(event: string, sizeBytes: number): void;
  recordBroadcast(room: string, event: string): void;
  recordDeliveryLatency(event: string, durationMs: number): void;
  recordSocketError(tenantId: string | undefined, errorCode: string): void;
}

export class NoopSocketMetrics implements ISocketMetrics {
  recordMatchingLatency(_tenantId: string, _durationMs: number): void {}
  recordFanoutDuration(_tenantId: string, _durationMs: number): void {}
  incrementAssignmentSuccess(_tenantId: string): void {}
  incrementAssignmentTimeout(_tenantId: string): void {}
  incrementStaleDetection(_tenantId: string): void {}
  incrementDriverLost(_tenantId: string): void {}

  recordActiveConnection(
    _tenantId: string,
    _type: "driver" | "consumer",
    _count: number
  ): void {}
  recordHeartbeat(_tenantId: string, _driverId: string): void {}
  recordSubscription(
    _tenantId: string,
    _roomType: "tenant" | "driver" | "session" | "tracking"
  ): void {}
  recordUnsubscription(
    _tenantId: string,
    _roomType: "tenant" | "driver" | "session" | "tracking"
  ): void {}
  recordMessageSent(_event: string, _sizeBytes: number): void {}
  recordMessageReceived(_event: string, _sizeBytes: number): void {}
  recordBroadcast(_room: string, _event: string): void {}
  recordDeliveryLatency(_event: string, _durationMs: number): void {}
  recordSocketError(_tenantId: string | undefined, _errorCode: string): void {}
}
