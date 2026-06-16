import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FanoutTimeoutWorker } from '@/internal/workers/fanout/FanoutTimeoutWorker.js';
import { RetryWorker } from '@/internal/workers/retry/RetryWorker.js';
import { DriverStaleDetector } from '@/internal/workers/presence/DriverStaleDetector.js';
import { DriverLostMonitor } from '@/internal/workers/presence/DriverLostMonitor.js';
import { CleanupWorker } from '@/internal/workers/cleanup/CleanupWorker.js';
import { SessionState, DispatchWaveStatus, DriverStatus } from '@motus/types';

describe('Workers', () => {
  let sessionRepo: any;
  let driverRepo: any;
  let lockMgr: any;
  let clock: any;
  let idGen: any;
  let metrics: any;
  let eventBus: any;
  let fanoutEngine: any;
  let sessionMgr: any;
  let driverMgr: any;

  beforeEach(() => {
    sessionRepo = {
      get: vi.fn(),
      save: vi.fn()
    };
    driverRepo = {
      get: vi.fn(),
      save: vi.fn(),
      findNearbyDrivers: vi.fn(),
      setDriverStatus: vi.fn()
    };
    lockMgr = {
      acquireLock: vi.fn().mockResolvedValue(true),
      releaseLock: vi.fn().mockResolvedValue(undefined)
    };
    clock = {
      now: vi.fn().mockReturnValue(new Date('2026-06-11T14:00:00Z'))
    };
    idGen = {
      generateEventId: vi.fn().mockReturnValue('evt_123'),
      generateSessionId: vi.fn(),
      generateDriverId: vi.fn(),
      generateTenantId: vi.fn()
    };
    metrics = {
      recordMatchingLatency: vi.fn(),
      recordFanoutDuration: vi.fn(),
      incrementAssignmentSuccess: vi.fn(),
      incrementAssignmentTimeout: vi.fn(),
      incrementStaleDetection: vi.fn(),
      incrementDriverLost: vi.fn()
    };
    eventBus = {
      publish: vi.fn()
    };
    fanoutEngine = {
      releaseWaveLocks: vi.fn(),
      startNextWave: vi.fn()
    };
    sessionMgr = {
      reassignSession: vi.fn()
    };
    driverMgr = {
      setDriverStale: vi.fn()
    };
  });

  describe('FanoutTimeoutWorker', () => {
    it('should skip timeout evaluation if lock cannot be acquired', async () => {
      lockMgr.acquireLock.mockResolvedValue(false);
      const worker = new FanoutTimeoutWorker(
        sessionMgr,
        sessionRepo,
        lockMgr,
        fanoutEngine,
        clock,
        idGen,
        metrics
      );

      await worker.checkWaveExpirations('tnt_123', 'ses_abc');

      expect(sessionRepo.get).not.toHaveBeenCalled();
      expect(lockMgr.releaseLock).not.toHaveBeenCalled();
    });

    it('should ignore session if not in SEARCHING state', async () => {
      sessionRepo.get.mockResolvedValue({
        tenantId: 'tnt_123',
        id: 'ses_abc',
        status: SessionState.DRIVER_ASSIGNED,
        waves: []
      });

      const worker = new FanoutTimeoutWorker(
        sessionMgr,
        sessionRepo,
        lockMgr,
        fanoutEngine,
        clock,
        idGen,
        metrics
      );

      await worker.checkWaveExpirations('tnt_123', 'ses_abc');

      expect(sessionRepo.save).not.toHaveBeenCalled();
      expect(lockMgr.releaseLock).toHaveBeenCalledWith('lock:session:ses_abc');
    });

    it('should transition wave to EXPIRED if timeout duration has passed', async () => {
      const activeWave = {
        waveNumber: 1,
        status: DispatchWaveStatus.ACTIVE,
        candidates: ['drv_1'],
        assignments: [{ driverId: 'drv_1', status: 'PENDING' }],
        expiresAt: '2026-06-11T13:59:00Z' // 1 minute in the past
      };

      sessionRepo.get.mockResolvedValue({
        tenantId: 'tnt_123',
        id: 'ses_abc',
        status: SessionState.SEARCHING,
        pickupPoint: { latitude: 0, longitude: 0 },
        destinationPoint: { latitude: 1, longitude: 1 },
        telemetryPath: [],
        eventTimeline: [],
        waves: [activeWave],
        assignedDriverId: undefined
      });

      const worker = new FanoutTimeoutWorker(
        sessionMgr,
        sessionRepo,
        lockMgr,
        fanoutEngine,
        clock,
        idGen,
        metrics
      );

      await worker.checkWaveExpirations('tnt_123', 'ses_abc');

      expect(sessionRepo.save).toHaveBeenCalled();
      expect(metrics.incrementAssignmentTimeout).toHaveBeenCalledWith('tnt_123');
      expect(fanoutEngine.releaseWaveLocks).toHaveBeenCalledWith('ses_abc', ['drv_1']);
      expect(fanoutEngine.startNextWave).toHaveBeenCalled();
      expect(lockMgr.releaseLock).toHaveBeenCalledWith('lock:session:ses_abc');
    });
  });

  describe('RetryWorker', () => {
    it('should call fanoutEngine.startNextWave if session is still searching', async () => {
      const mockSession = {
        tenantId: 'tnt_123',
        id: 'ses_abc',
        status: SessionState.SEARCHING
      };
      sessionRepo.get.mockResolvedValue(mockSession);

      const worker = new RetryWorker(
        sessionMgr,
        sessionRepo,
        lockMgr,
        fanoutEngine
      );

      await worker.evaluateRetry('tnt_123', 'ses_abc');

      expect(fanoutEngine.startNextWave).toHaveBeenCalledWith(mockSession);
      expect(lockMgr.releaseLock).toHaveBeenCalledWith('lock:session:ses_abc');
    });
  });

  describe('DriverStaleDetector', () => {
    it('should detect stale drivers and invoke driverManager.setDriverStale', async () => {
      const mockDrivers = [
        {
          id: 'drv_1',
          status: 'ONLINE' as DriverStatus,
          location: {
            latitude: 0,
            longitude: 0,
            timestamp: '2026-06-11T13:57:00Z' // 3 minutes ago (> 120s)
          }
        },
        {
          id: 'drv_2',
          status: 'ONLINE' as DriverStatus,
          location: {
            latitude: 0,
            longitude: 0,
            timestamp: '2026-06-11T13:59:50Z' // 10 seconds ago (< 120s)
          }
        }
      ];

      driverRepo.findNearbyDrivers.mockResolvedValue(mockDrivers);

      const detector = new DriverStaleDetector(
        driverMgr,
        driverRepo,
        lockMgr,
        clock,
        metrics
      );

      await detector.scanStaleDrivers('tnt_123');

      expect(driverMgr.setDriverStale).toHaveBeenCalledWith('tnt_123', 'drv_1');
      expect(driverMgr.setDriverStale).not.toHaveBeenCalledWith('tnt_123', 'drv_2');
      expect(metrics.incrementStaleDetection).toHaveBeenCalledWith('tnt_123');
    });
  });

  describe('DriverLostMonitor', () => {
    it('should transition session state to DRIVER_LOST and publish event', async () => {
      const mockSession = {
        tenantId: 'tnt_123',
        id: 'ses_abc',
        status: SessionState.DRIVER_ASSIGNED,
        pickupPoint: { latitude: 0, longitude: 0 },
        destinationPoint: { latitude: 1, longitude: 1 },
        telemetryPath: [{ latitude: 0.5, longitude: 0.5, timestamp: '123' }],
        eventTimeline: [],
        waves: [],
        assignedDriverId: 'drv_1'
      };

      sessionRepo.get.mockResolvedValue(mockSession);

      const monitor = new DriverLostMonitor(
        sessionMgr,
        sessionRepo,
        lockMgr,
        eventBus,
        clock,
        idGen,
        metrics
      );

      await monitor.handleDriverDisconnect('tnt_123', 'ses_abc');

      expect(sessionRepo.save).toHaveBeenCalledWith(expect.objectContaining({
        status: SessionState.DRIVER_LOST,
        previousSessionState: SessionState.DRIVER_ASSIGNED
      }));
      expect(eventBus.publish).toHaveBeenCalledWith(expect.objectContaining({
        eventName: 'session.driver_lost'
      }));
      expect(metrics.incrementDriverLost).toHaveBeenCalledWith('tnt_123');
    });

    it('should restore stashed state on reconnect', async () => {
      const mockSession = {
        tenantId: 'tnt_123',
        id: 'ses_abc',
        status: SessionState.DRIVER_LOST,
        pickupPoint: { latitude: 0, longitude: 0 },
        destinationPoint: { latitude: 1, longitude: 1 },
        telemetryPath: [],
        eventTimeline: [],
        waves: [],
        assignedDriverId: 'drv_1',
        previousSessionState: SessionState.DRIVER_ASSIGNED
      };

      sessionRepo.get.mockResolvedValue(mockSession);

      const monitor = new DriverLostMonitor(
        sessionMgr,
        sessionRepo,
        lockMgr,
        eventBus,
        clock,
        idGen,
        metrics
      );

      await monitor.handleDriverReconnect('tnt_123', 'ses_abc');

      expect(sessionRepo.save).toHaveBeenCalledWith(expect.objectContaining({
        status: SessionState.DRIVER_ASSIGNED,
        previousSessionState: undefined
      }));
    });

    it('should reassign session when recovery timeout is processed', async () => {
      const mockSession = {
        tenantId: 'tnt_123',
        id: 'ses_abc',
        status: SessionState.DRIVER_LOST
      };

      sessionRepo.get.mockResolvedValue(mockSession);

      const monitor = new DriverLostMonitor(
        sessionMgr,
        sessionRepo,
        lockMgr,
        eventBus,
        clock,
        idGen,
        metrics
      );

      await monitor.handleRecoveryTimeout('tnt_123', 'ses_abc');

      expect(sessionMgr.reassignSession).toHaveBeenCalledWith(expect.objectContaining({
        tenantId: 'tnt_123',
        sessionId: 'ses_abc'
      }));
    });
  });

  describe('CleanupWorker', () => {
    it('should lock and fetch session to evaluate pruning', async () => {
      const mockSession = {
        tenantId: 'tnt_123',
        id: 'ses_abc',
        status: SessionState.COMPLETED
      };
      sessionRepo.get.mockResolvedValue(mockSession);

      const worker = new CleanupWorker(sessionRepo, lockMgr);
      await worker.pruneSessionData('tnt_123', 'ses_abc');

      expect(sessionRepo.get).toHaveBeenCalledWith('tnt_123', 'ses_abc');
      expect(lockMgr.releaseLock).toHaveBeenCalledWith('lock:session:ses_abc');
    });
  });
});
