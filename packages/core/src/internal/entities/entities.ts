import {
  Tenant,
  Driver,
  Session,
  SessionReport,
  Zone,
  MatchingConfiguration,
  FanoutConfiguration,
  RetryPolicy,
  Location,
  TelemetryPoint,
  SessionEvent,
  DispatchWave,
  TenantId,
  DriverId,
  SessionId,
  Distance,
  Duration,
  ETA,
  DriverStatus,
  SessionState
} from '@motus/types';

export class TenantEntity implements Tenant {
  constructor(
    public readonly id: TenantId,
    public readonly name: string,
    public readonly matchingConfig: MatchingConfiguration,
    public readonly fanoutConfig: FanoutConfiguration,
    public readonly retryPolicy: RetryPolicy,
    public readonly zones: readonly Zone[] = []
  ) {}
}

export class DriverEntity implements Driver {
  constructor(
    public readonly tenantId: TenantId,
    public readonly id: DriverId,
    public readonly status: DriverStatus,
    public readonly location: Location,
    public readonly currentLoad: number,
    public readonly capacity: number,
    public readonly lastHeartbeat: string,
    public readonly vehicleType: string = 'CAR'
  ) {}
}

export class SessionEntity implements Session {
  public readonly assignedDriverId?: DriverId;
  public readonly requiredVehicleType?: string;
  public readonly previousSessionState?: SessionState;

  constructor(
    public readonly tenantId: TenantId,
    public readonly id: SessionId,
    public readonly status: SessionState,
    public readonly pickupPoint: Location,
    public readonly destinationPoint: Location,
    public readonly telemetryPath: readonly TelemetryPoint[] = [],
    public readonly eventTimeline: readonly SessionEvent[] = [],
    public readonly waves: readonly DispatchWave[] = [],
    assignedDriverId?: DriverId,
    requiredVehicleType?: string,
    previousSessionState?: SessionState
  ) {
    if (assignedDriverId !== undefined && assignedDriverId !== null) {
      this.assignedDriverId = assignedDriverId;
    }
    if (requiredVehicleType !== undefined && requiredVehicleType !== null) {
      this.requiredVehicleType = requiredVehicleType;
    }
    if (previousSessionState !== undefined && previousSessionState !== null) {
      this.previousSessionState = previousSessionState;
    }
  }
}

export class SessionReportEntity implements SessionReport {
  constructor(
    public readonly tenantId: TenantId,
    public readonly sessionId: SessionId,
    public readonly startTime: string,
    public readonly endTime: string,
    public readonly totalDistance: Distance,
    public readonly totalDuration: Duration,
    public readonly initialEstimatedEta: ETA,
    public readonly actualPath: readonly TelemetryPoint[] = []
  ) {}
}
