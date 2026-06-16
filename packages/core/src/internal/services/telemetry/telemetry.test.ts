import { describe, it, expect, vi, beforeEach } from 'vitest';
import { encodePolyline, decodePolyline } from '@/internal/services/telemetry/polyline.js';
import { TelemetryManager } from '@/internal/services/telemetry/TelemetryManager.js';
import { TrackingManager } from '@/internal/managers/TrackingManager.js';
import { DriverManager } from '@/internal/managers/DriverManager.js';


describe('Phase 4 Telemetry: Google Polyline', () => {
  it('should encode and decode coordinates cleanly', () => {
    const coords = [
      { latitude: 38.5, longitude: -120.2 },
      { latitude: 40.7, longitude: -120.95 },
      { latitude: 43.252, longitude: -126.453 }
    ];

    const encoded = encodePolyline(coords);
    expect(encoded).toBe('_p~iF~ps|U_ulLnnqC_mqNvxq`@');

    const decoded = decodePolyline(encoded);
    expect(decoded[0].latitude).toBeCloseTo(38.5, 5);
    expect(decoded[1].longitude).toBeCloseTo(-120.95, 5);
  });
});

describe('Phase 4 Telemetry: TelemetryManager Metrics', () => {
  const manager = new TelemetryManager();

  it('should enforce adaptive sampling thresholds', () => {
    const last = { latitude: 12.9716, longitude: 77.5946, timestamp: '2026-06-11T12:00:00Z' };

    // Small move (<25m) and low duration (<10s) -> should NOT sample
    const closePoint = { latitude: 12.97161, longitude: 77.59461, timestamp: '2026-06-11T12:00:05Z' };
    expect(manager.shouldSample(last, closePoint)).toBe(false);

    // Large move (>25m) -> should sample
    const farPoint = { latitude: 12.9725, longitude: 77.5955, timestamp: '2026-06-11T12:00:05Z' };
    expect(manager.shouldSample(last, farPoint)).toBe(true);

    // High duration (>10s) -> should sample
    const delayedPoint = { latitude: 12.97161, longitude: 77.59461, timestamp: '2026-06-11T12:00:15Z' };
    expect(manager.shouldSample(last, delayedPoint)).toBe(true);
  });

  it('should compute distance, duration, idle, and average speed', () => {
    const path = [
      { latitude: 12.9716, longitude: 77.5946, timestamp: '2026-06-11T12:00:00Z', speed: 0.5 },
      { latitude: 12.9725, longitude: 77.5955, timestamp: '2026-06-11T12:00:10Z', speed: 5.0 },
      { latitude: 12.9730, longitude: 77.5960, timestamp: '2026-06-11T12:00:20Z', speed: 0.2 }
    ];

    const metrics = manager.calculateMetrics(path);
    expect(metrics.totalDurationSeconds).toBe(20);
    expect(metrics.totalDistanceMeters).toBeGreaterThan(100);
    // Idle accumulated from index 0 to 1 (10s) where speed was < 1.0 m/s
    expect(metrics.idleDurationSeconds).toBe(10);
    expect(metrics.avgSpeedMps).toBe(metrics.totalDistanceMeters / 20);
  });

  it('should handle empty or single point paths when calculating metrics', () => {
    const emptyMetrics = manager.calculateMetrics([]);
    expect(emptyMetrics.totalDistanceMeters).toBe(0);
    expect(emptyMetrics.totalDurationSeconds).toBe(0);

    const singleMetrics = manager.calculateMetrics([{ latitude: 12.9716, longitude: 77.5946, timestamp: '2026-06-11T12:00:00Z' }]);
    expect(singleMetrics.totalDistanceMeters).toBe(0);
    expect(singleMetrics.totalDurationSeconds).toBe(0);
  });

  it('should compress path to google polyline cleanly', () => {
    const coords = [
      { latitude: 38.5, longitude: -120.2, timestamp: '1' },
      { latitude: 40.7, longitude: -120.95, timestamp: '2' }
    ];
    const encoded = manager.compressPath(coords);
    expect(encoded).toBe('_p~iF~ps|U_ulLnnqC');
  });
});

describe('Phase 4 Telemetry: TrackingManager Ingestion', () => {
  let driverRepo: any;
  let eventBus: any;
  let clock: any;
  let idGen: any;
  let driverMgr: any;

  beforeEach(() => {
    const drivers = new Map();
    driverRepo = {
      save: vi.fn(async (d) => { drivers.set(`${d.tenantId}:${d.id}`, d); }),
      get: vi.fn(async (tid, did) => drivers.get(`${tid}:${did}`) || null),
      updateLocation: vi.fn(async () => {}),
      setDriverStatus: vi.fn(async () => {})
    };

    eventBus = {
      publish: vi.fn()
    };

    clock = {
      now: vi.fn(() => new Date('2026-06-11T12:00:00Z'))
    };

    idGen = {
      generateEventId: () => 'evt_test'
    };

    driverMgr = new DriverManager(driverRepo, eventBus, clock, idGen);
  });

  it('should validate inputs, check backpressure, and publish location updates', async () => {
    const tracking = new TrackingManager(driverRepo, eventBus, clock, idGen, driverMgr);

    await driverMgr.registerDriver({ tenantId: 'tnt_1', driverId: 'drv_1', capacity: 1, vehicleType: 'CAR', idempotencyKey: 'i1' });

    // Valid update
    await tracking.updateDriverLocation({
      tenantId: 'tnt_1',
      driverId: 'drv_1',
      latitude: 10,
      longitude: 10,
      timestamp: '2026-06-11T12:00:00Z',
      speed: 10
    });

    expect(driverRepo.updateLocation).toHaveBeenCalled();
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'driver.location.updated' })
    );

    // Backpressure: consecutive update <1s (same timestamp) should be throttled/skipped
    vi.mocked(driverRepo.updateLocation).mockClear();
    await tracking.updateDriverLocation({
      tenantId: 'tnt_1',
      driverId: 'drv_1',
      latitude: 10.01,
      longitude: 10.01,
      timestamp: '2026-06-11T12:00:00Z',
      speed: 10
    });
    expect(driverRepo.updateLocation).not.toHaveBeenCalled();

    // Invalid coordinates range
    await expect(
      tracking.updateDriverLocation({
        tenantId: 'tnt_1',
        driverId: 'drv_1',
        latitude: 100, // Invalid lat (>90)
        longitude: 10,
        timestamp: '2026-06-11T12:00:00Z'
      })
    ).rejects.toThrow();
  });
});
