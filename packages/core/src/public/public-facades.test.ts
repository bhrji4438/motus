import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Motus } from '@/public/Motus.js';
import { TenantNamespace } from '@/public/TenantNamespace.js';
import { DriverNamespace } from '@/public/DriverNamespace.js';
import { SessionNamespace } from '@/public/SessionNamespace.js';
import { QueryNamespace } from '@/public/QueryNamespace.js';
import { EventNamespace } from '@/public/EventNamespace.js';
import { SessionState, DriverStatus } from '@motus/types';

describe('Public Facades', () => {
  let tenantMgr: any;
  let driverMgr: any;
  let sessionMgr: any;
  let clock: any;
  let eventDispatcher: any;

  beforeEach(() => {
    tenantMgr = {
      registerTenant: vi.fn(),
      updateTenant: vi.fn(),
      getTenant: vi.fn()
    };
    driverMgr = {
      registerDriver: vi.fn(),
      updateDriver: vi.fn(),
      getDriver: vi.fn(),
      setDriverOnline: vi.fn(),
      setDriverOffline: vi.fn(),
      setDriverPaused: vi.fn()
    };
    sessionMgr = {
      createSession: vi.fn(),
      cancelSession: vi.fn(),
      completeSession: vi.fn(),
      reassignSession: vi.fn(),
      getSession: vi.fn()
    };
    clock = {
      now: vi.fn().mockReturnValue(new Date('2026-06-11T14:00:00Z'))
    };
    eventDispatcher = {
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn()
    };
  });

  describe('Motus (Main Facade)', () => {
    it('should initialize and register dependencies correctly', () => {
      const sdk = new Motus(tenantMgr, driverMgr, sessionMgr, clock, eventDispatcher);
      expect(sdk.tenant).toBeInstanceOf(TenantNamespace);
      expect(sdk.driver).toBeInstanceOf(DriverNamespace);
      expect(sdk.session).toBeInstanceOf(SessionNamespace);
      expect(sdk.query).toBeInstanceOf(QueryNamespace);
      expect(sdk.events).toBeInstanceOf(EventNamespace);

      const handler = () => {};
      sdk.events.on('driver.online', handler);
      expect(eventDispatcher.on).toHaveBeenCalledWith('driver.online', handler);

      sdk.events.off('driver.online', handler);
      expect(eventDispatcher.off).toHaveBeenCalledWith('driver.online', handler);

      sdk.events.once('driver.online', handler);
      expect(eventDispatcher.once).toHaveBeenCalledWith('driver.online', handler);
    });

    it('should handle event registration when eventDispatcher is absent', () => {
      const sdk = new Motus(tenantMgr, driverMgr, sessionMgr, clock);
      const handler = () => {};
      expect(() => sdk.events.on('driver.online', handler)).not.toThrow();
      expect(() => sdk.events.off('driver.online', handler)).not.toThrow();
      expect(() => sdk.events.once('driver.online', handler)).not.toThrow();
    });

    it('should ignore driver namespace actions if tracking or assignment managers are not configured', async () => {
      const facade = new DriverNamespace(driverMgr);
      // No setDependencies called
      await expect(facade.updateDriverLocation({ tenantId: 'tnt_1', driverId: 'drv_1', latitude: 1, longitude: 1, timestamp: 't' })).resolves.not.toThrow();
      await expect(facade.acceptSessionOffer('tnt_1', 'drv_1', 'ses_1', 1)).resolves.not.toThrow();
      await expect(facade.rejectSessionOffer('tnt_1', 'drv_1', 'ses_1', 1)).resolves.not.toThrow();
    });
  });

  describe('TenantNamespace', () => {
    it('should register, update, and get tenant with mapping to TenantResult', async () => {
      const mockTenant = {
        id: 'tnt_1',
        name: 'Tenant 1',
        matchingConfig: { strategy: 'distance', maxCandidatesPerWave: 3 },
        retryPolicy: { waveTimeoutSeconds: 8 },
        zones: [{ name: 'Zone A', boundary: [] }]
      };
      tenantMgr.registerTenant.mockResolvedValue(mockTenant);
      tenantMgr.updateTenant.mockResolvedValue(mockTenant);
      tenantMgr.getTenant.mockResolvedValue(mockTenant);

      const facade = new TenantNamespace(tenantMgr);

      const regResult = await facade.registerTenant({
        tenantId: 'tnt_1',
        name: 'Tenant 1',
        matchingStrategy: 'distance' as any,
        idempotencyKey: 'i1'
      });
      expect(regResult.tenantId).toBe('tnt_1');
      expect(regResult.geofences).toHaveLength(1);

      const updResult = await facade.updateTenant({
        tenantId: 'tnt_1',
        name: 'Tenant 1'
      });
      expect(updResult.name).toBe('Tenant 1');

      const getResult = await facade.getTenant('tnt_1');
      expect(getResult.tenantId).toBe('tnt_1');
    });
  });

  describe('DriverNamespace', () => {
    it('should register, update, get, online, offline, paused drivers', async () => {
      const mockDriver = {
        id: 'drv_1',
        tenantId: 'tnt_1',
        status: DriverStatus.ONLINE,
        capacity: 2,
        currentLoad: 0,
        vehicleType: 'CAR',
        lastHeartbeat: '2026-06-11T14:00:00Z',
        location: { latitude: 12.34, longitude: 56.78 }
      };
      driverMgr.registerDriver.mockResolvedValue(mockDriver);
      driverMgr.updateDriver.mockResolvedValue(mockDriver);
      driverMgr.getDriver.mockResolvedValue(mockDriver);

      const facade = new DriverNamespace(driverMgr);

      const regResult = await facade.registerDriver({
        tenantId: 'tnt_1',
        driverId: 'drv_1',
        capacity: 2,
        vehicleType: 'CAR',
        idempotencyKey: 'i1'
      });
      expect(regResult.id).toBe('drv_1');
      expect(regResult.lastLocation).toEqual({ latitude: 12.34, longitude: 56.78 });

      const updResult = await facade.updateDriver({
        tenantId: 'tnt_1',
        driverId: 'drv_1',
        capacity: 3
      });
      expect(updResult.capacity).toBe(2); // Mocked return value capacity

      const getResult = await facade.getDriver('tnt_1', 'drv_1');
      expect(getResult.id).toBe('drv_1');

      await facade.setDriverOnline('tnt_1', 'drv_1');
      expect(driverMgr.setDriverOnline).toHaveBeenCalledWith('tnt_1', 'drv_1');

      await facade.setDriverOffline('tnt_1', 'drv_1');
      expect(driverMgr.setDriverOffline).toHaveBeenCalledWith('tnt_1', 'drv_1');

      await facade.setDriverPaused('tnt_1', 'drv_1');
      expect(driverMgr.setDriverPaused).toHaveBeenCalledWith('tnt_1', 'drv_1');
    });

    it('should delegate updateLocation, acceptOffer, rejectOffer to corresponding managers', async () => {
      const trackingMgr = { updateDriverLocation: vi.fn() };
      const assignmentMgr = { acceptSessionOffer: vi.fn(), rejectSessionOffer: vi.fn() };

      const facade = new DriverNamespace(driverMgr);
      facade.setDependencies(trackingMgr, assignmentMgr);

      await facade.updateDriverLocation({ tenantId: 'tnt_1', driverId: 'drv_1', latitude: 1, longitude: 1, timestamp: 't' });
      expect(trackingMgr.updateDriverLocation).toHaveBeenCalled();

      await facade.acceptSessionOffer('tnt_1', 'drv_1', 'ses_1', 1);
      expect(assignmentMgr.acceptSessionOffer).toHaveBeenCalledWith('tnt_1', 'drv_1', 'ses_1', 1);

      await facade.rejectSessionOffer('tnt_1', 'drv_1', 'ses_1', 1);
      expect(assignmentMgr.rejectSessionOffer).toHaveBeenCalledWith('tnt_1', 'drv_1', 'ses_1', 1);
    });
  });

  describe('SessionNamespace', () => {
    it('should create, cancel, complete, reassign sessions', async () => {
      const mockSession = {
        id: 'ses_1',
        tenantId: 'tnt_1',
        status: SessionState.SEARCHING,
        pickupPoint: { latitude: 1, longitude: 1, timestamp: '2026-06-11T13:59:00Z' },
        destinationPoint: { latitude: 2, longitude: 2 },
        assignedDriverId: 'drv_1'
      };

      sessionMgr.createSession.mockResolvedValue(mockSession);
      sessionMgr.cancelSession.mockResolvedValue({ ...mockSession, status: SessionState.CANCELLED });
      sessionMgr.completeSession.mockResolvedValue({ ...mockSession, status: SessionState.COMPLETED });
      sessionMgr.reassignSession.mockResolvedValue(mockSession);

      const facade = new SessionNamespace(sessionMgr, clock);

      const res1 = await facade.createSession({ tenantId: 'tnt_1', sessionId: 'ses_1', pickup: { latitude: 1, longitude: 1 }, destination: { latitude: 2, longitude: 2 }, idempotencyKey: 'i' });
      expect(res1.status).toBe(SessionState.SEARCHING);
      expect(res1.assignedDriverId).toBe('drv_1');

      const res2 = await facade.cancelSession({ tenantId: 'tnt_1', sessionId: 'ses_1', idempotencyKey: 'i' });
      expect(res2.status).toBe(SessionState.CANCELLED);

      const res3 = await facade.completeSession({ tenantId: 'tnt_1', sessionId: 'ses_1', idempotencyKey: 'i' });
      expect(res3.status).toBe(SessionState.COMPLETED);

      const res4 = await facade.reassignSession({ tenantId: 'tnt_1', sessionId: 'ses_1', reason: 'r', idempotencyKey: 'i' });
      expect(res4.status).toBe(SessionState.SEARCHING);
    });
  });

  describe('QueryNamespace', () => {
    it('should get session, get session events, get session report', async () => {
      const mockSession = {
        id: 'ses_1',
        tenantId: 'tnt_1',
        status: SessionState.SEARCHING,
        pickupPoint: { latitude: 1, longitude: 1 },
        destinationPoint: { latitude: 2, longitude: 2 },
        assignedDriverId: 'drv_1',
        eventTimeline: [
          { eventId: 'evt_1', eventName: 'session.created', timestamp: '2026-06-11T13:59:00Z', payload: {} }
        ]
      };

      sessionMgr.getSession.mockResolvedValue(mockSession);
      const facade = new QueryNamespace(sessionMgr, clock);

      const sRes = await facade.getSession('tnt_1', 'ses_1');
      expect(sRes.id).toBe('ses_1');

      const events = await facade.getSessionEvents('tnt_1', 'ses_1');
      expect(events).toHaveLength(1);
      expect(events[0].eventId).toBe('evt_1');

      // Test without report generator configured
      await expect(facade.getSessionReport('tnt_1', 'ses_1')).rejects.toThrow('Report generator not configured.');

      // With report generator
      const reportGen = {
        getSessionReport: vi.fn().mockResolvedValue({ sessionId: 'ses_1' })
      };
      facade.setDependencies(reportGen);
      const rRes = await facade.getSessionReport('tnt_1', 'ses_1');
      expect(rRes.sessionId).toBe('ses_1');
    });
  });
});
