import type {
  Tenant,
  Driver,
  Session,
  TelemetryPoint,
  SessionEvent,
  Location,
  MatchingConfiguration,
  FanoutConfiguration,
  RetryPolicy,
  Zone,
  DispatchWave,
  TenantId,
  DriverId,
  SessionId,
  DriverStatus,
  SessionState,
} from '@motus/types';

// ─── Schema Version Constants ───────────────────────────────────────────────

const TENANT_SCHEMA_VERSION = 1;
const DRIVER_SCHEMA_VERSION = 1;
const SESSION_SCHEMA_VERSION = 1;
const TELEMETRY_STREAM_VERSION = 1;
const EVENT_STREAM_VERSION = 1;

// ─── Error ──────────────────────────────────────────────────────────────────

/**
 * Thrown when a stored Redis entity has a schema version newer than the
 * current reader. This indicates a deployment ordering issue.
 */
export class RedisSchemaVersionError extends Error {
  constructor(
    public readonly entityType: string,
    public readonly storedVersion: number,
    public readonly readerVersion: number
  ) {
    super(
      `${entityType} schema version ${storedVersion} is newer than reader version ${readerVersion}. ` +
        `Deploy the latest @motus/redis package.`
    );
    this.name = 'RedisSchemaVersionError';
  }
}

// ─── Helper utilities ────────────────────────────────────────────────────────

function parseVersion(fields: Record<string, string>): number {
  return parseInt(fields['_version'] ?? '0', 10);
}

function guardVersion(entityType: string, storedVersion: number, currentVersion: number): void {
  if (storedVersion > currentVersion) {
    throw new RedisSchemaVersionError(entityType, storedVersion, currentVersion);
  }
}

function safeJSON<T>(str: string | undefined, fallback: T): T {
  if (!str) return fallback;
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

// ─── Tenant Serializer ───────────────────────────────────────────────────────

export class TenantSerializer {
  static serialize(tenant: Tenant): Record<string, string> {
    return {
      id: tenant.id,
      name: tenant.name,
      matchingConfig: JSON.stringify(tenant.matchingConfig),
      fanoutConfig: JSON.stringify(tenant.fanoutConfig),
      retryPolicy: JSON.stringify(tenant.retryPolicy),
      zones: JSON.stringify(tenant.zones),
      _version: String(TENANT_SCHEMA_VERSION),
    };
  }

  static deserialize(fields: Record<string, string>): Tenant {
    const v = parseVersion(fields);
    guardVersion('Tenant', v, TENANT_SCHEMA_VERSION);

    return {
      id: fields['id'] as TenantId,
      name: fields['name'] ?? '',
      matchingConfig: safeJSON<MatchingConfiguration>(fields['matchingConfig'], {
        strategy: 'DISTANCE' as any,
        maxSearchRadius: { value: 5000, unit: 'METERS' },
        maxCandidatesPerWave: 5,
      }),
      fanoutConfig: safeJSON<FanoutConfiguration>(fields['fanoutConfig'], {
        mode: 'PARALLEL',
        intervalSeconds: 5,
      }),
      retryPolicy: safeJSON<RetryPolicy>(fields['retryPolicy'], {
        maxWaves: 5,
        waveTimeoutSeconds: 30,
        reEvaluationDelaySeconds: 10,
      }),
      zones: safeJSON<Zone[]>(fields['zones'], []),
    };
  }
}

// ─── Driver Serializer ───────────────────────────────────────────────────────

export class DriverSerializer {
  static serialize(driver: Driver & { vehicleType?: string }): Record<string, string> {
    const fields: Record<string, string> = {
      id: driver.id,
      tenantId: driver.tenantId,
      status: driver.status,
      latitude: String(driver.location.latitude),
      longitude: String(driver.location.longitude),
      locationTimestamp: driver.location.timestamp,
      currentLoad: String(driver.currentLoad),
      capacity: String(driver.capacity),
      lastHeartbeat: driver.lastHeartbeat,
      vehicleType: driver.vehicleType ?? 'CAR',
      _version: String(DRIVER_SCHEMA_VERSION),
    };
    const loc = driver.location as any;
    if (loc.bearing !== undefined) {
      fields['bearing'] = String(loc.bearing);
    }
    if (loc.speed !== undefined) {
      fields['speed'] = String(loc.speed);
    }
    if (loc.accuracy !== undefined) {
      fields['accuracy'] = String(loc.accuracy);
    }
    return fields;
  }

  static deserialize(fields: Record<string, string>): Driver & { vehicleType: string } {
    const v = parseVersion(fields);
    guardVersion('Driver', v, DRIVER_SCHEMA_VERSION);

    const location: Location = {
      latitude: parseFloat(fields['latitude'] ?? '0'),
      longitude: parseFloat(fields['longitude'] ?? '0'),
      timestamp: fields['locationTimestamp'] ?? new Date().toISOString(),
    };
    if (fields['bearing'] !== undefined) {
      (location as any).bearing = parseFloat(fields['bearing']);
    }
    if (fields['speed'] !== undefined) {
      (location as any).speed = parseFloat(fields['speed']);
    }
    if (fields['accuracy'] !== undefined) {
      (location as any).accuracy = parseFloat(fields['accuracy']);
    }

    return {
      id: fields['id'] as DriverId,
      tenantId: fields['tenantId'] as TenantId,
      status: (fields['status'] ?? 'OFFLINE') as DriverStatus,
      location,
      currentLoad: parseInt(fields['currentLoad'] ?? '0', 10),
      capacity: parseInt(fields['capacity'] ?? '1', 10),
      lastHeartbeat: fields['lastHeartbeat'] ?? new Date().toISOString(),
      vehicleType: fields['vehicleType'] ?? 'CAR',
    };
  }
}

// ─── Session Serializer ──────────────────────────────────────────────────────

export class SessionSerializer {
  static serialize(session: Session & { requiredVehicleType?: string }): Record<string, string> {
    const fields: Record<string, string> = {
      id: session.id,
      tenantId: session.tenantId,
      status: session.status,
      pickupLatitude: String(session.pickupPoint.latitude),
      pickupLongitude: String(session.pickupPoint.longitude),
      pickupTimestamp: session.pickupPoint.timestamp,
      destinationLatitude: String(session.destinationPoint.latitude),
      destinationLongitude: String(session.destinationPoint.longitude),
      destinationTimestamp: session.destinationPoint.timestamp,
      waves: JSON.stringify(session.waves),
      _version: String(SESSION_SCHEMA_VERSION),
    };
    if (session.assignedDriverId !== undefined) {
      fields['assignedDriverId'] = session.assignedDriverId;
    }
    if (session.requiredVehicleType !== undefined) {
      fields['requiredVehicleType'] = session.requiredVehicleType;
    }
    return fields;
  }

  static deserialize(fields: Record<string, string>): Session & { requiredVehicleType?: string } {
    const v = parseVersion(fields);
    guardVersion('Session', v, SESSION_SCHEMA_VERSION);

    const pickupPoint: Location = {
      latitude: parseFloat(fields['pickupLatitude'] ?? '0'),
      longitude: parseFloat(fields['pickupLongitude'] ?? '0'),
      timestamp: fields['pickupTimestamp'] ?? new Date().toISOString(),
    };
    const destinationPoint: Location = {
      latitude: parseFloat(fields['destinationLatitude'] ?? '0'),
      longitude: parseFloat(fields['destinationLongitude'] ?? '0'),
      timestamp: fields['destinationTimestamp'] ?? new Date().toISOString(),
    };
    const waves: DispatchWave[] = safeJSON<DispatchWave[]>(fields['waves'], []);

    const session: Session & { requiredVehicleType?: string } = {
      id: fields['id'] as SessionId,
      tenantId: fields['tenantId'] as TenantId,
      status: (fields['status'] ?? 'CREATED') as SessionState,
      pickupPoint,
      destinationPoint,
      waves,
      telemetryPath: [],   // hydrated from stream on demand
      eventTimeline: [],   // hydrated from stream on demand
    };
    if (fields['assignedDriverId']) {
      (session as any).assignedDriverId = fields['assignedDriverId'] as DriverId;
    }
    if (fields['requiredVehicleType']) {
      session.requiredVehicleType = fields['requiredVehicleType'];
    }
    return session;
  }
}

// ─── Telemetry Stream Serializer ─────────────────────────────────────────────

export class TelemetrySerializer {
  static serializeToStream(point: TelemetryPoint): Record<string, string> {
    const fields: Record<string, string> = {
      latitude: String(point.latitude),
      longitude: String(point.longitude),
      timestamp: point.timestamp,
      _version: String(TELEMETRY_STREAM_VERSION),
    };
    if (point.accuracy !== undefined) fields['accuracy'] = String(point.accuracy);
    if (point.bearing !== undefined) fields['bearing'] = String(point.bearing);
    if (point.speed !== undefined) fields['speed'] = String(point.speed);
    return fields;
  }

  static deserializeFromStream(fields: Record<string, string>): TelemetryPoint {
    const v = parseVersion(fields);
    guardVersion('TelemetryStreamEntry', v, TELEMETRY_STREAM_VERSION);

    const point: TelemetryPoint = {
      latitude: parseFloat(fields['latitude'] ?? '0'),
      longitude: parseFloat(fields['longitude'] ?? '0'),
      timestamp: fields['timestamp'] ?? new Date().toISOString(),
    };
    if (fields['accuracy'] !== undefined) (point as any).accuracy = parseFloat(fields['accuracy']);
    if (fields['bearing'] !== undefined) (point as any).bearing = parseFloat(fields['bearing']);
    if (fields['speed'] !== undefined) (point as any).speed = parseFloat(fields['speed']);
    return point;
  }
}

// ─── Event Stream Serializer ─────────────────────────────────────────────────

export class EventStreamSerializer {
  static serializeToStream(event: SessionEvent): Record<string, string> {
    return {
      eventId: event.eventId,
      eventName: event.eventName,
      timestamp: event.timestamp,
      payload: JSON.stringify(event.payload),
      _version: String(EVENT_STREAM_VERSION),
    };
  }

  static deserializeFromStream(fields: Record<string, string>): SessionEvent {
    const v = parseVersion(fields);
    guardVersion('EventStreamEntry', v, EVENT_STREAM_VERSION);

    return {
      eventId: fields['eventId'] ?? '',
      eventName: fields['eventName'] ?? '',
      timestamp: fields['timestamp'] ?? new Date().toISOString(),
      payload: safeJSON<Record<string, unknown>>(fields['payload'], {}),
    };
  }
}
