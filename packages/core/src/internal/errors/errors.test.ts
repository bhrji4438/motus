import { describe, it, expect } from 'vitest';
import { ErrorFactory, MotusCoreError } from '@/internal/errors/ErrorFactory.js';
import { isErrorCodeRetryable } from '@/internal/errors/Retryability.js';
import { HTTP_CODE_MAP, WEBSOCKET_CODE_MAP } from '@/internal/errors/ErrorCodes.js';
import { ErrorCode } from '@motus/types';

describe('Errors Subsystem', () => {
  describe('MotusCoreError', () => {
    it('should construct correctly with standard properties', () => {
      const details = { foo: 'bar' };
      const timestamp = new Date().toISOString();
      const err = new MotusCoreError(
        ErrorCode.MOTUS_INTERNAL_ERROR,
        'Internal failure',
        'network disconnect',
        details,
        timestamp
      );

      expect(err.code).toBe(ErrorCode.MOTUS_INTERNAL_ERROR);
      expect(err.message).toBe('Internal failure');
      expect(err.cause).toBe('network disconnect');
      expect(err.details).toEqual(details);
      expect(err.timestamp).toBe(timestamp);
    });
  });

  describe('ErrorFactory', () => {
    it('should generate driverNotFound error', () => {
      const err = ErrorFactory.driverNotFound('drv_1', 'tnt_1');
      expect(err.code).toBe(ErrorCode.MOTUS_DRIVER_NOT_FOUND);
      expect(err.details).toEqual({ driverId: 'drv_1', tenantId: 'tnt_1' });
    });

    it('should generate sessionNotFound error', () => {
      const err = ErrorFactory.sessionNotFound('ses_1', 'tnt_1');
      expect(err.code).toBe(ErrorCode.MOTUS_SESSION_NOT_FOUND);
      expect(err.details).toEqual({ sessionId: 'ses_1', tenantId: 'tnt_1' });
    });

    it('should generate invalidTransition error', () => {
      const err = ErrorFactory.invalidTransition('CREATED', 'COMPLETED');
      expect(err.code).toBe(ErrorCode.MOTUS_INVALID_TRANSITION);
      expect(err.details).toEqual({ currentState: 'CREATED', targetState: 'COMPLETED' });
    });

    it('should generate driverBusy error', () => {
      const err = ErrorFactory.driverBusy('drv_1', 1, 1);
      expect(err.code).toBe(ErrorCode.MOTUS_DRIVER_BUSY);
      expect(err.details).toEqual({ driverId: 'drv_1', currentLoad: 1, capacity: 1 });
    });

    it('should generate capacityExceeded error', () => {
      const err = ErrorFactory.capacityExceeded('tnt_1');
      expect(err.code).toBe(ErrorCode.MOTUS_CAPACITY_EXCEEDED);
      expect(err.details).toEqual({ tenantId: 'tnt_1' });
    });

    it('should generate invalidVehicleType error', () => {
      const err = ErrorFactory.invalidVehicleType('TRUCK', 'BIKE');
      expect(err.code).toBe(ErrorCode.MOTUS_INVALID_VEHICLE_TYPE);
      expect(err.details).toEqual({ required: 'TRUCK', provided: 'BIKE' });
    });

    it('should generate lockAcquisitionFailed error', () => {
      const err = ErrorFactory.lockAcquisitionFailed('key_1');
      expect(err.code).toBe(ErrorCode.MOTUS_LOCK_ACQUISITION_FAILED);
      expect(err.details).toEqual({ lockKey: 'key_1' });
    });

    it('should generate invalidArgument error', () => {
      const err = ErrorFactory.invalidArgument('param', 'must be positive');
      expect(err.code).toBe(ErrorCode.MOTUS_INVALID_ARGUMENT);
      expect(err.details).toEqual({ argumentName: 'param' });
    });

    it('should generate unauthorized error', () => {
      const err = ErrorFactory.unauthorized('Not allowed');
      expect(err.code).toBe(ErrorCode.MOTUS_UNAUTHORIZED);
    });

    it('should generate internalError error', () => {
      const err = ErrorFactory.internalError('Crash');
      expect(err.code).toBe(ErrorCode.MOTUS_INTERNAL_ERROR);
    });
  });

  describe('Retryability', () => {
    it('should correctly flag retryable error codes', () => {
      expect(isErrorCodeRetryable(ErrorCode.MOTUS_DRIVER_BUSY)).toBe(true);
      expect(isErrorCodeRetryable(ErrorCode.MOTUS_CAPACITY_EXCEEDED)).toBe(true);
      expect(isErrorCodeRetryable(ErrorCode.MOTUS_DRIVER_NOT_FOUND)).toBe(false);
    });
  });

  describe('Mappings', () => {
    it('should map HTTP status codes', () => {
      expect(HTTP_CODE_MAP[ErrorCode.MOTUS_DRIVER_NOT_FOUND]).toBe(404);
      expect(HTTP_CODE_MAP[ErrorCode.MOTUS_INTERNAL_ERROR]).toBe(500);
    });

    it('should map WebSocket status codes', () => {
      expect(WEBSOCKET_CODE_MAP[ErrorCode.MOTUS_DRIVER_NOT_FOUND]).toBe(4404);
      expect(WEBSOCKET_CODE_MAP[ErrorCode.MOTUS_INTERNAL_ERROR]).toBe(5000);
    });
  });
});
