import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MatchingStrategy, DriverStatus, SessionState, DispatchWaveStatus } from '@motus/types';
import { TenantManager } from '@/internal/managers/TenantManager.js';
import { DriverManager } from '@/internal/managers/DriverManager.js';
import { SessionManager } from '@/internal/managers/SessionManager.js';
import { AssignmentManager } from '@/internal/managers/AssignmentManager.js';
import { TrackingManager } from '@/internal/managers/TrackingManager.js';
import { SessionEntity } from '@/internal/entities/entities.js';

describe('Domain Managers Suite', () => {
  let tenantRepo: any;
  let driverRepo: any;
  let sessionRepo: any;
  let lockMgr: any;
  let eventBus: any;
  let clock: any;
  let idGen: any;
  let metrics: any;
  let etaProvider: any;
  let fanoutEngine: any;

  beforeEach(() => {
    const tenants = new Map();
    tenantRepo = {
      save: vi.fn(async (t) => { tenants.set(t.id, t); }),
      get: vi.fn(async (id) => tenants.get(id) || null)
    };

    const drivers = new Map();
    driverRepo = {
      save: vi.fn(async (d) => { drivers.set(`${d.tenantId}:${d.id}`, d); }),
      get: vi.fn(async (tid, did) => drivers.get(`${tid}:${did}`) || null),
      setDriverStatus: vi.fn(async (tid, did, status) => {
        const d = drivers.get(`${tid}:${did}`);
        if (d) {
          drivers.set(`${tid}:${did}`, { ...d, status });
        }
      }),
      updateLocation: vi.fn(),
      findNearbyDrivers: vi.fn(async () => Array.from(drivers.values()))
    };

    const sessions = new Map();
    sessionRepo = {
      save: vi.fn(async (s) => { sessions.set(`${s.tenantId}:${s.id}`, s); }),
      get: vi.fn(async (tid, sid) => sessions.get(`${tid}:${sid}`) || null)
    };

    lockMgr = {
      acquireLock: vi.fn(async () => true),
      releaseLock: vi.fn(async () => {})
    };

    eventBus = {
      publish: vi.fn()
    };

    clock = {
      now: vi.fn(() => new Date('2026-06-11T12:00:00Z'))
    };

    idGen = {
      generateTenantId: () => 'tnt_test',
      generateDriverId: () => 'drv_test',
      generateSessionId: () => 'ses_test',
      generateEventId: () => 'evt_test'
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
      calculateEta: vi.fn().mockResolvedValue({ durationSeconds: 150, distanceMeters: 800 })
    };

    fanoutEngine = {
      releaseWaveLocks: vi.fn(),
      startNextWave: vi.fn()
    };
  });

  describe('TenantManager', () => {
    it('should register and update a Tenant idempotently', async () => {
      const mgr = new TenantManager(tenantRepo, eventBus, clock, idGen);

      const t1 = await mgr.registerTenant({
        tenantId: 'tnt_1',
        name: 'Tenant 1',
        matchingStrategy: MatchingStrategy.DISTANCE,
        idempotencyKey: 'idem_tenant'
      });
      expect(t1.name).toBe('Tenant 1');

      // Idempotency: registering again returns the same
      const t2 = await mgr.registerTenant({
        tenantId: 'tnt_1',
        name: 'Different Name',
        matchingStrategy: MatchingStrategy.DISTANCE,
        idempotencyKey: 'idem_tenant'
      });
      expect(t2.name).toBe('Tenant 1');

      const updated = await mgr.updateTenant({
        tenantId: 'tnt_1',
        name: 'New Tenant Name'
      });
      expect(updated.name).toBe('New Tenant Name');

      const fetched = await mgr.getTenant('tnt_1');
      expect(fetched.name).toBe('New Tenant Name');
    });

    it('should throw if getting non-existent tenant', async () => {
      const mgr = new TenantManager(tenantRepo, eventBus, clock, idGen);
      await expect(mgr.getTenant('tnt_nonexistent')).rejects.toThrow();
    });
  });

  describe('DriverManager', () => {
    it('should manage Driver registration, updates, and status transitions', async () => {
      const mgr = new DriverManager(driverRepo, eventBus, clock, idGen);

      const d1 = await mgr.registerDriver({
        tenantId: 'tnt_1',
        driverId: 'drv_1',
        capacity: 2,
        vehicleType: 'CAR',
        idempotencyKey: 'i1'
      });
      expect(d1.id).toBe('drv_1');

      // Update
      const dUpd = await mgr.updateDriver({
        tenantId: 'tnt_1',
        driverId: 'drv_1',
        capacity: 3
      });
      expect(dUpd.capacity).toBe(3);

      // Transitions
      await mgr.setDriverOnline('tnt_1', 'drv_1');
      let fetched = await mgr.getDriver('tnt_1', 'drv_1');
      expect(fetched.status).toBe(DriverStatus.ONLINE);

      await mgr.setDriverPaused('tnt_1', 'drv_1');
      fetched = await mgr.getDriver('tnt_1', 'drv_1');
      expect(fetched.status).toBe(DriverStatus.PAUSED);

      await mgr.setDriverOffline('tnt_1', 'drv_1');
      fetched = await mgr.getDriver('tnt_1', 'drv_1');
      expect(fetched.status).toBe(DriverStatus.OFFLINE);

      await mgr.setDriverOnline('tnt_1', 'drv_1');
      await mgr.setDriverStale('tnt_1', 'drv_1');
      fetched = await mgr.getDriver('tnt_1', 'drv_1');
      expect(fetched.status).toBe(DriverStatus.STALE);
    });

    it('should throw on update driver not found', async () => {
      const mgr = new DriverManager(driverRepo, eventBus, clock, idGen);
      await expect(mgr.updateDriver({ tenantId: 'tnt_1', driverId: 'drv_missing' })).rejects.toThrow();
    });

    it('should bind and unbind driver load and transition state', async () => {
      const mgr = new DriverManager(driverRepo, eventBus, clock, idGen);
      await mgr.registerDriver({ tenantId: 'tnt_1', driverId: 'drv_1', capacity: 1, vehicleType: 'CAR', idempotencyKey: 'i1' });

      await mgr.bindDriver('tnt_1', 'drv_1');
      let d = await mgr.getDriver('tnt_1', 'drv_1');
      expect(d.currentLoad).toBe(1);
      expect(d.status).toBe(DriverStatus.BUSY);

      await mgr.unbindDriver('tnt_1', 'drv_1');
      d = await mgr.getDriver('tnt_1', 'drv_1');
      expect(d.currentLoad).toBe(0);
      expect(d.status).toBe(DriverStatus.ONLINE);
    });
  });

  describe('SessionManager', () => {
    let driverMgr: DriverManager;
    let sessionMgr: SessionManager;

    beforeEach(async () => {
      driverMgr = new DriverManager(driverRepo, eventBus, clock, idGen);
      sessionMgr = new SessionManager(sessionRepo, lockMgr, eventBus, clock, idGen, driverMgr);

      await driverMgr.registerDriver({ tenantId: 'tnt_1', driverId: 'drv_1', capacity: 1, vehicleType: 'CAR', idempotencyKey: 'i1' });
      await driverMgr.setDriverOnline('tnt_1', 'drv_1');
    });

    it('should create session and handle cancellation, completion, and reassignment', async () => {
      const s1 = await sessionMgr.createSession({
        tenantId: 'tnt_1',
        sessionId: 'ses_1',
        pickup: { latitude: 10, longitude: 10 },
        destination: { latitude: 20, longitude: 20 },
        idempotencyKey: 'i1'
      });
      expect(s1.id).toBe('ses_1');
      expect(s1.status).toBe(SessionState.SEARCHING);

      // Cancel session
      const sCancel = await sessionMgr.cancelSession({ tenantId: 'tnt_1', sessionId: 'ses_1', idempotencyKey: 'i_cancel' });
      expect(sCancel.status).toBe(SessionState.CANCELLED);

      // Completing a cancelled session should fail
      await expect(sessionMgr.completeSession({ tenantId: 'tnt_1', sessionId: 'ses_1', idempotencyKey: 'i_comp' })).rejects.toThrow();

      // Create another session
      const s2 = await sessionMgr.createSession({
        tenantId: 'tnt_1',
        sessionId: 'ses_2',
        pickup: { latitude: 10, longitude: 10 },
        destination: { latitude: 20, longitude: 20 },
        idempotencyKey: 'i2'
      });
      // Mock session having a driver assigned and in progress
      const sAssigned = new SessionEntity(
        s2.tenantId,
        s2.id,
        SessionState.IN_PROGRESS,
        s2.pickupPoint,
        s2.destinationPoint,
        [],
        [],
        [],
        'drv_1'
      );
      await sessionRepo.save(sAssigned);

      const sCompleted = await sessionMgr.completeSession({ tenantId: 'tnt_1', sessionId: 'ses_2', idempotencyKey: 'i_comp2' });
      expect(sCompleted.status).toBe(SessionState.COMPLETED);

      // Reassign session
      await sessionMgr.createSession({
        tenantId: 'tnt_1',
        sessionId: 'ses_3',
        pickup: { latitude: 10, longitude: 10 },
        destination: { latitude: 20, longitude: 20 },
        idempotencyKey: 'i3'
      });
      const sReassigned = await sessionMgr.reassignSession({ tenantId: 'tnt_1', sessionId: 'ses_3', reason: 'reassigning', idempotencyKey: 'i_reassign' });
      expect(sReassigned.status).toBe(SessionState.SEARCHING);
    });

    it('should throw if locks cannot be acquired or session not found', async () => {
      lockMgr.acquireLock.mockResolvedValue(false);
      await expect(sessionMgr.startMatching('tnt_1', 'ses_missing')).rejects.toThrow();
      await expect(sessionMgr.cancelSession({ tenantId: 'tnt_1', sessionId: 'ses_1', idempotencyKey: 'i_cancel' })).rejects.toThrow();
      await expect(sessionMgr.completeSession({ tenantId: 'tnt_1', sessionId: 'ses_1', idempotencyKey: 'i_comp' })).rejects.toThrow();
      await expect(sessionMgr.reassignSession({ tenantId: 'tnt_1', sessionId: 'ses_1', idempotencyKey: 'i_reassign' })).rejects.toThrow();
    });
  });

  describe('AssignmentManager', () => {
    let driverMgr: DriverManager;
    let assignmentMgr: AssignmentManager;

    beforeEach(async () => {
      driverMgr = new DriverManager(driverRepo, eventBus, clock, idGen);
      assignmentMgr = new AssignmentManager(
        sessionRepo,
        lockMgr,
        eventBus,
        clock,
        idGen,
        driverMgr,
        fanoutEngine,
        metrics,
        etaProvider
      );

      await driverMgr.registerDriver({ tenantId: 'tnt_1', driverId: 'drv_1', capacity: 1, vehicleType: 'CAR', idempotencyKey: 'i1' });
      await driverMgr.setDriverOnline('tnt_1', 'drv_1');
    });

    it('should accept a session offer successfully and release candidate locks', async () => {
      const activeWave = {
        waveNumber: 2,
        status: DispatchWaveStatus.ACTIVE,
        candidates: ['drv_1', 'drv_2'],
        assignments: [
          { driverId: 'drv_1', sessionId: 'ses_1', status: 'PENDING' as const, lockAcquired: true },
          { driverId: 'drv_2', sessionId: 'ses_1', status: 'PENDING' as const, lockAcquired: true }
        ],
        startedAt: '2026-06-11T12:00:00Z',
        expiresAt: '2026-06-11T13:00:00Z'
      };

      const session = new SessionEntity(
        'tnt_1',
        'ses_1',
        SessionState.SEARCHING,
        { latitude: 10, longitude: 10, timestamp: '2026-06-11T12:00:00Z' },
        { latitude: 11, longitude: 11, timestamp: '2026-06-11T12:00:00Z' },
        [],
        [],
        [activeWave]
      );
      await sessionRepo.save(session);

      await assignmentMgr.acceptSessionOffer('tnt_1', 'drv_1', 'ses_1', 2);

      const updated = await sessionRepo.get('tnt_1', 'ses_1');
      expect(updated.status).toBe(SessionState.DRIVER_ASSIGNED);
      expect(updated.assignedDriverId).toBe('drv_1');
      expect(updated.waves[0].status).toBe(DispatchWaveStatus.COMPLETED);
      expect(updated.waves[0].assignments.find((a: any) => a.driverId === 'drv_1').status).toBe('ACCEPTED');
      expect(updated.waves[0].assignments.find((a: any) => a.driverId === 'drv_2').status).toBe('EXPIRED');

      expect(fanoutEngine.releaseWaveLocks).toHaveBeenCalledWith('ses_1', ['drv_2']);
    });

    it('should reject a session offer and start next wave when no pending left', async () => {
      const activeWave = {
        waveNumber: 2,
        status: DispatchWaveStatus.ACTIVE,
        candidates: ['drv_1'],
        assignments: [
          { driverId: 'drv_1', sessionId: 'ses_1', status: 'PENDING' as const, lockAcquired: true }
        ],
        startedAt: '2026-06-11T12:00:00Z',
        expiresAt: '2026-06-11T13:00:00Z'
      };

      const session = new SessionEntity(
        'tnt_1',
        'ses_1',
        SessionState.SEARCHING,
        { latitude: 10, longitude: 10, timestamp: '2026-06-11T12:00:00Z' },
        { latitude: 11, longitude: 11, timestamp: '2026-06-11T12:00:00Z' },
        [],
        [],
        [activeWave]
      );
      await sessionRepo.save(session);

      await assignmentMgr.rejectSessionOffer('tnt_1', 'drv_1', 'ses_1', 2);

      const updated = await sessionRepo.get('tnt_1', 'ses_1');
      expect(updated.waves[0].assignments[0].status).toBe('REJECTED');
      expect(updated.waves[0].status).toBe(DispatchWaveStatus.EXPIRED);
      expect(fanoutEngine.startNextWave).toHaveBeenCalled();
    });

    it('should throw if lock acquisition fails during acceptance or rejection', async () => {
      lockMgr.acquireLock.mockResolvedValue(false);
      await expect(assignmentMgr.acceptSessionOffer('tnt_1', 'drv_1', 'ses_1', 1)).rejects.toThrow();
      await expect(assignmentMgr.rejectSessionOffer('tnt_1', 'drv_1', 'ses_1', 1)).rejects.toThrow();
    });

    it('should throw if session not found during offer acceptance or rejection', async () => {
      await expect(assignmentMgr.acceptSessionOffer('tnt_1', 'drv_1', 'ses_nonexistent', 1)).rejects.toThrow();
      await expect(assignmentMgr.rejectSessionOffer('tnt_1', 'drv_1', 'ses_nonexistent', 1)).rejects.toThrow();
    });

    it('should throw if driver lock fails during offer acceptance', async () => {
      const activeWave = {
        waveNumber: 2,
        status: DispatchWaveStatus.ACTIVE,
        candidates: ['drv_1'],
        assignments: [{ driverId: 'drv_1', sessionId: 'ses_1', status: 'PENDING' as const, lockAcquired: true }],
        startedAt: '2026-06-11T12:00:00Z',
        expiresAt: '2026-06-11T13:00:00Z'
      };
      const session = new SessionEntity(
        'tnt_1',
        'ses_1',
        SessionState.SEARCHING,
        { latitude: 10, longitude: 10, timestamp: '2026-06-11T12:00:00Z' },
        { latitude: 11, longitude: 11, timestamp: '2026-06-11T12:00:00Z' },
        [],
        [],
        [activeWave]
      );
      await sessionRepo.save(session);

      // Lock session succeeds, lock driver fails
      lockMgr.acquireLock.mockImplementation(async (key: string) => {
        if (key.startsWith('lock:session')) return true;
        return false;
      });

      await expect(assignmentMgr.acceptSessionOffer('tnt_1', 'drv_1', 'ses_1', 2)).rejects.toThrow('Failed to acquire lock for key: lock:driver:drv_1');
    });
  });

  describe('TrackingManager', () => {
    let driverMgr: DriverManager;
    let trackingMgr: TrackingManager;

    beforeEach(async () => {
      driverMgr = new DriverManager(driverRepo, eventBus, clock, idGen);
      trackingMgr = new TrackingManager(driverRepo, eventBus, clock, idGen, driverMgr);

      await driverMgr.registerDriver({ tenantId: 'tnt_1', driverId: 'drv_1', capacity: 1, vehicleType: 'CAR', idempotencyKey: 'i1' });
      await driverMgr.setDriverOnline('tnt_1', 'drv_1');
    });

    it('should ingest location updates with speed/bearing range validation', async () => {
      await expect(trackingMgr.updateDriverLocation({
        tenantId: 'tnt_1',
        driverId: 'drv_1',
        latitude: -100, // Invalid
        longitude: 50,
        timestamp: '2026-06-11T12:00:00Z'
      })).rejects.toThrow('Latitude must be in range');

      await expect(trackingMgr.updateDriverLocation({
        tenantId: 'tnt_1',
        driverId: 'drv_1',
        latitude: 10,
        longitude: 200, // Invalid
        timestamp: '2026-06-11T12:00:00Z'
      })).rejects.toThrow('Longitude must be in range');

      await expect(trackingMgr.updateDriverLocation({
        tenantId: 'tnt_1',
        driverId: 'drv_1',
        latitude: 10,
        longitude: 50,
        bearing: -10, // Invalid
        timestamp: '2026-06-11T12:00:00Z'
      })).rejects.toThrow('Bearing must be in range');

      await expect(trackingMgr.updateDriverLocation({
        tenantId: 'tnt_1',
        driverId: 'drv_1',
        latitude: 10,
        longitude: 50,
        speed: 150, // Invalid
        timestamp: '2026-06-11T12:00:00Z'
      })).rejects.toThrow('Speed must be in range');

      // Too far in the future
      await expect(trackingMgr.updateDriverLocation({
        tenantId: 'tnt_1',
        driverId: 'drv_1',
        latitude: 10,
        longitude: 50,
        timestamp: '2026-06-11T12:05:00Z' // 5 mins in future (> 500ms)
      })).rejects.toThrow('Timestamp is too far in the future');

      // Valid ingestion
      await trackingMgr.updateDriverLocation({
        tenantId: 'tnt_1',
        driverId: 'drv_1',
        latitude: 10,
        longitude: 50,
        speed: 10,
        bearing: 45,
        timestamp: '2026-06-11T12:00:00Z'
      });

      expect(driverRepo.updateLocation).toHaveBeenCalled();
      expect(eventBus.publish).toHaveBeenCalledWith(expect.objectContaining({
        eventName: 'driver.location.updated'
      }));
    });

    it('should throttle frequent updates from same driver', async () => {
      // First update (processed)
      await trackingMgr.updateDriverLocation({
        tenantId: 'tnt_1',
        driverId: 'drv_1',
        latitude: 10,
        longitude: 50,
        speed: 10,
        timestamp: '2026-06-11T12:00:00Z'
      });

      // Second update (too fast, < 1000ms)
      driverRepo.updateLocation.mockClear();
      await trackingMgr.updateDriverLocation({
        tenantId: 'tnt_1',
        driverId: 'drv_1',
        latitude: 10.0001,
        longitude: 50.0001,
        speed: 10,
        timestamp: '2026-06-11T12:00:00.500Z'
      });
      expect(driverRepo.updateLocation).not.toHaveBeenCalled();

      // Third update (stationary, throttled to 5 seconds)
      clock.now.mockReturnValue(new Date('2026-06-11T12:00:01Z'));
      await trackingMgr.updateDriverLocation({
        tenantId: 'tnt_1',
        driverId: 'drv_1',
        latitude: 10,
        longitude: 50,
        speed: 0,
        timestamp: '2026-06-11T12:00:01Z'
      });

      driverRepo.updateLocation.mockClear();
      // Update at 3s should be ignored because speed is 0 (requires 5s)
      clock.now.mockReturnValue(new Date('2026-06-11T12:00:03Z'));
      await trackingMgr.updateDriverLocation({
        tenantId: 'tnt_1',
        driverId: 'drv_1',
        latitude: 10,
        longitude: 50,
        speed: 0,
        timestamp: '2026-06-11T12:00:03Z'
      });
      expect(driverRepo.updateLocation).not.toHaveBeenCalled();
    });
  });
});
