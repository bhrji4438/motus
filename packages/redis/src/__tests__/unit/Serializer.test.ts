import { describe, it, expect } from 'vitest';
import { DriverSerializer, SessionSerializer, TelemetrySerializer, EventStreamSerializer, RedisSchemaVersionError } from '@/serialization/Serializer.js';

const makeDriver = () => ({
  id: 'drv_001',
  tenantId: 'tnt_abc',
  status: 'ONLINE' as any,
  location: {
    latitude: 28.6139,
    longitude: 77.2090,
    timestamp: '2024-01-01T00:00:00.000Z',
    bearing: 90,
    speed: 30,
    accuracy: 5,
  },
  currentLoad: 1,
  capacity: 3,
  lastHeartbeat: '2024-01-01T00:00:00.000Z',
  vehicleType: 'CAR',
});

describe('DriverSerializer', () => {
  it('roundtrips a Driver with all fields', () => {
    const driver = makeDriver();
    const fields = DriverSerializer.serialize(driver);
    const result = DriverSerializer.deserialize(fields);
    expect(result.id).toBe(driver.id);
    expect(result.tenantId).toBe(driver.tenantId);
    expect(result.status).toBe(driver.status);
    expect(result.location.latitude).toBeCloseTo(driver.location.latitude, 4);
    expect(result.location.longitude).toBeCloseTo(driver.location.longitude, 4);
    expect(result.vehicleType).toBe('CAR');
    expect(result.currentLoad).toBe(1);
  });

  it('stores _version field', () => {
    const fields = DriverSerializer.serialize(makeDriver());
    expect(fields['_version']).toBe('1');
  });

  it('throws RedisSchemaVersionError for future schema versions', () => {
    const fields = DriverSerializer.serialize(makeDriver());
    fields['_version'] = '999';
    expect(() => DriverSerializer.deserialize(fields)).toThrow(RedisSchemaVersionError);
  });

  it('deserializes missing _version as version 0 (migration path)', () => {
    const driver = makeDriver();
    const fields = DriverSerializer.serialize(driver);
    delete (fields as any)['_version'];
    // Should not throw (v0 -> v1 migration: currently same shape, so should parse fine)
    expect(() => DriverSerializer.deserialize(fields)).not.toThrow();
  });
});

describe('SessionSerializer', () => {
  const session = {
    id: 'ses_001',
    tenantId: 'tnt_abc',
    status: 'CREATED' as any,
    pickupPoint: { latitude: 28.6, longitude: 77.2, timestamp: '2024-01-01T00:00:00.000Z' },
    destinationPoint: { latitude: 28.7, longitude: 77.3, timestamp: '2024-01-01T00:00:00.000Z' },
    waves: [],
    telemetryPath: [],
    eventTimeline: [],
    requiredVehicleType: 'CAR',
  };

  it('roundtrips a Session', () => {
    const fields = SessionSerializer.serialize(session);
    const result = SessionSerializer.deserialize(fields);
    expect(result.id).toBe(session.id);
    expect(result.tenantId).toBe(session.tenantId);
    expect(result.status).toBe(session.status);
    expect(result.pickupPoint.latitude).toBeCloseTo(28.6, 4);
    expect(result.requiredVehicleType).toBe('CAR');
  });

  it('does not store telemetryPath in Hash fields', () => {
    const fields = SessionSerializer.serialize(session);
    expect(fields).not.toHaveProperty('telemetryPath');
    expect(fields).not.toHaveProperty('eventTimeline');
  });
});

describe('TelemetrySerializer', () => {
  const point = {
    latitude: 28.6139,
    longitude: 77.2090,
    timestamp: '2024-01-01T00:00:00.000Z',
    bearing: 45,
    speed: 20,
    accuracy: 3,
  };

  it('roundtrips a TelemetryPoint through stream fields', () => {
    const fields = TelemetrySerializer.serializeToStream(point);
    const result = TelemetrySerializer.deserializeFromStream(fields);
    expect(result.latitude).toBeCloseTo(point.latitude, 4);
    expect(result.longitude).toBeCloseTo(point.longitude, 4);
    expect(result.timestamp).toBe(point.timestamp);
    expect((result as any).bearing).toBeCloseTo(45, 1);
  });
});

describe('EventStreamSerializer', () => {
  const event = {
    eventId: 'evt_001',
    eventName: 'session.created',
    timestamp: '2024-01-01T00:00:00.000Z',
    payload: { sessionId: 'ses_001', tenantId: 'tnt_abc' },
  };

  it('roundtrips a SessionEvent', () => {
    const fields = EventStreamSerializer.serializeToStream(event);
    const result = EventStreamSerializer.deserializeFromStream(fields);
    expect(result.eventId).toBe(event.eventId);
    expect(result.eventName).toBe(event.eventName);
    expect(result.payload).toEqual(event.payload);
  });
});
