import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isPointInPolygon } from '@/internal/services/matching/raycast.js';
import { calculateHaversineDistance } from '@/internal/services/matching/haversine.js';
import { MatchingEngine } from '@/internal/services/matching/MatchingEngine.js';
import { MatchingStrategy, DriverStatus } from '@motus/types';

describe('Ray-casting algorithm (raycast)', () => {
  const polygon = [
    { latitude: 10, longitude: 10 },
    { latitude: 10, longitude: 20 },
    { latitude: 20, longitude: 20 },
    { latitude: 20, longitude: 10 }
  ];

  it('should return true for points inside the polygon', () => {
    expect(isPointInPolygon({ latitude: 15, longitude: 15 }, polygon)).toBe(true);
  });

  it('should return false for points outside the polygon', () => {
    expect(isPointInPolygon({ latitude: 5, longitude: 5 }, polygon)).toBe(false);
    expect(isPointInPolygon({ latitude: 25, longitude: 25 }, polygon)).toBe(false);
  });

  it('should return false if polygon has less than 3 points', () => {
    expect(isPointInPolygon({ latitude: 15, longitude: 15 }, [])).toBe(false);
    expect(isPointInPolygon({ latitude: 15, longitude: 15 }, [{ latitude: 10, longitude: 10 }])).toBe(false);
  });
});

describe('Haversine distance (haversine)', () => {
  it('should calculate distance between two coordinates correctly', () => {
    const loc1 = { latitude: 0, longitude: 0 };
    const loc2 = { latitude: 0, longitude: 1 }; // Approx 111.3 km
    const dist = calculateHaversineDistance(loc1, loc2);
    expect(dist).toBeGreaterThan(111000);
    expect(dist).toBeLessThan(112000);
  });
});

describe('MatchingEngine', () => {
  let tenantRepo: any;
  let driverRepo: any;
  let clock: any;
  let logger: any;
  let metrics: any;
  let etaProvider: any;
  let customMatchingProvider: any;

  beforeEach(() => {
    tenantRepo = {
      get: vi.fn()
    };
    driverRepo = {
      findNearbyDrivers: vi.fn()
    };
    clock = {
      now: vi.fn().mockReturnValue(new Date('2026-06-11T14:00:00Z'))
    };
    logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };
    metrics = {
      recordMatchingLatency: vi.fn(),
      recordFanoutDuration: vi.fn(),
      incrementAssignmentSuccess: vi.fn(),
      incrementAssignmentTimeout: vi.fn(),
      incrementStaleDetection: vi.fn(),
      incrementDriverLost: vi.fn()
    };
    etaProvider = {
      calculateEta: vi.fn()
    };
    customMatchingProvider = {
      scoreCandidates: vi.fn()
    };
  });

  const getMockSession = (requiredVehicleType?: string) => ({
    tenantId: 'tnt_1',
    id: 'ses_1',
    pickupPoint: { latitude: 15, longitude: 15 },
    requiredVehicleType
  } as any);

  it('should return empty array and log error if tenant is not found', async () => {
    tenantRepo.get.mockResolvedValue(null);
    const engine = new MatchingEngine(tenantRepo, driverRepo, clock, logger, metrics);

    const candidates = await engine.findCandidates(getMockSession(), 5000, 3);
    expect(candidates).toEqual([]);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('not found during candidate matching.'));
  });

  it('should filter out drivers with stale location timestamp (> 120s)', async () => {
    tenantRepo.get.mockResolvedValue({
      id: 'tnt_1',
      matchingConfig: { strategy: MatchingStrategy.DISTANCE }
    });

    driverRepo.findNearbyDrivers.mockResolvedValue([
      {
        id: 'drv_stale',
        status: DriverStatus.ONLINE,
        capacity: 1,
        currentLoad: 0,
        location: {
          latitude: 15.01,
          longitude: 15.01,
          timestamp: '2026-06-11T13:57:00Z' // 3 minutes ago
        }
      },
      {
        id: 'drv_fresh',
        status: DriverStatus.ONLINE,
        capacity: 1,
        currentLoad: 0,
        location: {
          latitude: 15.01,
          longitude: 15.01,
          timestamp: '2026-06-11T13:59:50Z' // 10 seconds ago
        }
      }
    ]);

    const engine = new MatchingEngine(tenantRepo, driverRepo, clock, logger, metrics);
    const candidates = await engine.findCandidates(getMockSession(), 5000, 3);

    expect(candidates).toContain('drv_fresh');
    expect(candidates).not.toContain('drv_stale');
  });

  it('should filter out busy drivers (load >= capacity)', async () => {
    tenantRepo.get.mockResolvedValue({
      id: 'tnt_1',
      matchingConfig: { strategy: MatchingStrategy.DISTANCE }
    });

    driverRepo.findNearbyDrivers.mockResolvedValue([
      {
        id: 'drv_busy',
        status: DriverStatus.ONLINE,
        capacity: 1,
        currentLoad: 1,
        location: {
          latitude: 15.01,
          longitude: 15.01,
          timestamp: '2026-06-11T13:59:50Z'
        }
      }
    ]);

    const engine = new MatchingEngine(tenantRepo, driverRepo, clock, logger, metrics);
    const candidates = await engine.findCandidates(getMockSession(), 5000, 3);

    expect(candidates).toEqual([]);
  });

  it('should filter out drivers with vehicle type mismatch', async () => {
    tenantRepo.get.mockResolvedValue({
      id: 'tnt_1',
      matchingConfig: { strategy: MatchingStrategy.DISTANCE }
    });

    driverRepo.findNearbyDrivers.mockResolvedValue([
      {
        id: 'drv_truck',
        status: DriverStatus.ONLINE,
        capacity: 1,
        currentLoad: 0,
        vehicleType: 'TRUCK',
        location: {
          latitude: 15.01,
          longitude: 15.01,
          timestamp: '2026-06-11T13:59:50Z'
        }
      },
      {
        id: 'drv_car',
        status: DriverStatus.ONLINE,
        capacity: 1,
        currentLoad: 0,
        vehicleType: 'CAR',
        location: {
          latitude: 15.01,
          longitude: 15.01,
          timestamp: '2026-06-11T13:59:50Z'
        }
      }
    ]);

    const engine = new MatchingEngine(tenantRepo, driverRepo, clock, logger, metrics);
    const candidates = await engine.findCandidates(getMockSession('TRUCK'), 5000, 3);

    expect(candidates).toContain('drv_truck');
    expect(candidates).not.toContain('drv_car');
  });

  it('should filter out drivers outside geofence zones', async () => {
    const boundary = [
      { latitude: 10, longitude: 10 },
      { latitude: 10, longitude: 20 },
      { latitude: 20, longitude: 20 },
      { latitude: 20, longitude: 10 }
    ];

    tenantRepo.get.mockResolvedValue({
      id: 'tnt_1',
      matchingConfig: { strategy: MatchingStrategy.DISTANCE },
      zones: [{ name: 'Zone1', boundary }]
    });

    driverRepo.findNearbyDrivers.mockResolvedValue([
      {
        id: 'drv_in',
        status: DriverStatus.ONLINE,
        capacity: 1,
        currentLoad: 0,
        location: {
          latitude: 15,
          longitude: 15, // Inside
          timestamp: '2026-06-11T13:59:50Z'
        }
      },
      {
        id: 'drv_out',
        status: DriverStatus.ONLINE,
        capacity: 1,
        currentLoad: 0,
        location: {
          latitude: 25,
          longitude: 25, // Outside
          timestamp: '2026-06-11T13:59:50Z'
        }
      }
    ]);

    const engine = new MatchingEngine(tenantRepo, driverRepo, clock, logger, metrics);
    const candidates = await engine.findCandidates(getMockSession(), 5000, 3);

    expect(candidates).toContain('drv_in');
    expect(candidates).not.toContain('drv_out');
  });

  it('should rank by ETA strategy if selected and provider is available', async () => {
    tenantRepo.get.mockResolvedValue({
      id: 'tnt_1',
      matchingConfig: { strategy: MatchingStrategy.ETA }
    });

    driverRepo.findNearbyDrivers.mockResolvedValue([
      {
        id: 'drv_far',
        status: DriverStatus.ONLINE,
        capacity: 1,
        currentLoad: 0,
        location: { latitude: 15.1, longitude: 15.1, timestamp: '2026-06-11T13:59:50Z' }
      },
      {
        id: 'drv_near',
        status: DriverStatus.ONLINE,
        capacity: 1,
        currentLoad: 0,
        location: { latitude: 15.01, longitude: 15.01, timestamp: '2026-06-11T13:59:50Z' }
      }
    ]);

    etaProvider.calculateEta.mockImplementation(async (origin: any, _dest: any) => {
      if (origin.latitude === 15.1) return { durationSeconds: 600, distanceMeters: 5000 };
      return { durationSeconds: 120, distanceMeters: 1000 };
    });

    const engine = new MatchingEngine(tenantRepo, driverRepo, clock, logger, metrics, etaProvider);
    const candidates = await engine.findCandidates(getMockSession(), 10000, 2);

    expect(candidates[0]).toBe('drv_near');
    expect(candidates[1]).toBe('drv_far');
  });

  it('should fallback to distance ranking if ETA calculation times out (> 100ms)', async () => {
    tenantRepo.get.mockResolvedValue({
      id: 'tnt_1',
      matchingConfig: { strategy: MatchingStrategy.ETA }
    });

    driverRepo.findNearbyDrivers.mockResolvedValue([
      {
        id: 'drv_far',
        status: DriverStatus.ONLINE,
        capacity: 1,
        currentLoad: 0,
        location: { latitude: 15.1, longitude: 15.1, timestamp: '2026-06-11T13:59:50Z' }
      },
      {
        id: 'drv_near',
        status: DriverStatus.ONLINE,
        capacity: 1,
        currentLoad: 0,
        location: { latitude: 15.01, longitude: 15.01, timestamp: '2026-06-11T13:59:50Z' }
      }
    ]);

    etaProvider.calculateEta.mockImplementation(async () => {
      // Simulate delay > 100ms
      await new Promise(resolve => globalThis.setTimeout(resolve, 150));
      return { durationSeconds: 120, distanceMeters: 1000 };
    });

    const engine = new MatchingEngine(tenantRepo, driverRepo, clock, logger, metrics, etaProvider);
    const candidates = await engine.findCandidates(getMockSession(), 10000, 2);

    // Should fall back to sorting by distance
    expect(candidates[0]).toBe('drv_near');
    expect(candidates[1]).toBe('drv_far');
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('ETA calculation fallback to distance'));
  });

  it('should rank using custom matching provider if CUSTOM strategy selected', async () => {
    tenantRepo.get.mockResolvedValue({
      id: 'tnt_1',
      matchingConfig: { strategy: MatchingStrategy.CUSTOM }
    });

    driverRepo.findNearbyDrivers.mockResolvedValue([
      {
        id: 'drv_1',
        status: DriverStatus.ONLINE,
        capacity: 1,
        currentLoad: 0,
        location: { latitude: 15, longitude: 15, timestamp: '2026-06-11T13:59:50Z' }
      },
      {
        id: 'drv_2',
        status: DriverStatus.ONLINE,
        capacity: 1,
        currentLoad: 0,
        location: { latitude: 15, longitude: 15, timestamp: '2026-06-11T13:59:50Z' }
      }
    ]);

    customMatchingProvider.scoreCandidates.mockResolvedValue([
      { driverId: 'drv_1', score: 10 },
      { driverId: 'drv_2', score: 90 }
    ]);

    const engine = new MatchingEngine(tenantRepo, driverRepo, clock, logger, metrics, undefined, customMatchingProvider);
    const candidates = await engine.findCandidates(getMockSession(), 10000, 2);

    expect(candidates[0]).toBe('drv_2');
    expect(candidates[1]).toBe('drv_1');
  });

  it('should catch error and return empty array if findCandidates crashes internally', async () => {
    tenantRepo.get.mockRejectedValue(new Error('DB connection failed'));
    const engine = new MatchingEngine(tenantRepo, driverRepo, clock, logger, metrics);

    const candidates = await engine.findCandidates(getMockSession(), 5000, 3);
    expect(candidates).toEqual([]);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error in MatchingEngine'), expect.any(Error));
  });
});
