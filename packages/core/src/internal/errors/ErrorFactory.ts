import { ErrorCode, MotusError } from "@motus/types";

export class MotusCoreError extends Error implements MotusError {
  public readonly code: ErrorCode;
  public readonly timestamp: string;
  public readonly details?: Record<string, any>;
  public override readonly cause?: string;

  constructor(
    code: ErrorCode,
    message: string,
    cause?: string,
    details?: Record<string, any>,
    timestamp?: string
  ) {
    super(message);
    this.code = code;
    this.name = "MotusCoreError";
    if (details !== undefined && details !== null) {
      this.details = details;
    }
    this.timestamp = timestamp || new Date().toISOString();
    if (cause) {
      this.cause = cause;
    }
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const ErrorFactory = {
  driverNotFound(
    driverId: string,
    tenantId: string,
    cause?: string,
    timestamp?: string
  ): MotusCoreError {
    return new MotusCoreError(
      ErrorCode.MOTUS_DRIVER_NOT_FOUND,
      `Driver with ID ${driverId} not found in tenant ${tenantId}.`,
      cause,
      { driverId, tenantId },
      timestamp
    );
  },

  sessionNotFound(
    sessionId: string,
    tenantId: string,
    cause?: string,
    timestamp?: string
  ): MotusCoreError {
    return new MotusCoreError(
      ErrorCode.MOTUS_SESSION_NOT_FOUND,
      `Session with ID ${sessionId} not found in tenant ${tenantId}.`,
      cause,
      { sessionId, tenantId },
      timestamp
    );
  },

  invalidTransition(
    currentState: string,
    targetState: string,
    cause?: string,
    details?: Record<string, any>,
    timestamp?: string
  ): MotusCoreError {
    return new MotusCoreError(
      ErrorCode.MOTUS_INVALID_TRANSITION,
      `Invalid state transition: Cannot transition from ${currentState} to ${targetState}.`,
      cause,
      { currentState, targetState, ...details },
      timestamp
    );
  },

  driverBusy(
    driverId: string,
    currentLoad: number,
    capacity: number,
    cause?: string,
    timestamp?: string
  ): MotusCoreError {
    return new MotusCoreError(
      ErrorCode.MOTUS_DRIVER_BUSY,
      `Driver ${driverId} is busy (load: ${currentLoad}/${capacity}).`,
      cause,
      { driverId, currentLoad, capacity },
      timestamp
    );
  },

  capacityExceeded(
    tenantId: string,
    message?: string,
    cause?: string,
    timestamp?: string
  ): MotusCoreError {
    return new MotusCoreError(
      ErrorCode.MOTUS_CAPACITY_EXCEEDED,
      message || `Capacity limit exceeded for tenant ${tenantId}.`,
      cause,
      { tenantId },
      timestamp
    );
  },

  invalidVehicleType(
    required: string,
    provided: string,
    cause?: string,
    timestamp?: string
  ): MotusCoreError {
    return new MotusCoreError(
      ErrorCode.MOTUS_INVALID_VEHICLE_TYPE,
      `Vehicle type mismatch: required '${required}', provided '${provided}'.`,
      cause,
      { required, provided },
      timestamp
    );
  },

  lockAcquisitionFailed(
    key: string,
    cause?: string,
    timestamp?: string
  ): MotusCoreError {
    return new MotusCoreError(
      ErrorCode.MOTUS_LOCK_ACQUISITION_FAILED,
      `Failed to acquire lock for key: ${key}.`,
      cause,
      { lockKey: key },
      timestamp
    );
  },

  invalidArgument(
    argumentName: string,
    message: string,
    cause?: string,
    timestamp?: string
  ): MotusCoreError {
    return new MotusCoreError(
      ErrorCode.MOTUS_INVALID_ARGUMENT,
      `Invalid argument '${argumentName}': ${message}`,
      cause,
      { argumentName },
      timestamp
    );
  },

  unauthorized(
    message: string,
    cause?: string,
    timestamp?: string
  ): MotusCoreError {
    return new MotusCoreError(
      ErrorCode.MOTUS_UNAUTHORIZED,
      message,
      cause,
      undefined,
      timestamp
    );
  },

  internalError(
    message: string,
    cause?: string,
    timestamp?: string
  ): MotusCoreError {
    return new MotusCoreError(
      ErrorCode.MOTUS_INTERNAL_ERROR,
      message,
      cause,
      undefined,
      timestamp
    );
  },
};
