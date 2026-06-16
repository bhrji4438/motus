import { ErrorCode } from '@/domain/enums.js';

/**
 * Standardized, transport-independent contract representing errors
 * returned by the Motus server API or thrown by the SDK.
 */
export interface MotusError {
  /**
   * Platform-wide canonical error identifier.
   */
  readonly code: ErrorCode;
  /**
   * Human-readable, descriptive explanation of the error condition.
   */
  readonly message: string;
  /**
   * Underlying technical cause or validation details leading to the error.
   */
  readonly cause?: string;
  /**
   * UTC ISO 8601 capture timestamp (YYYY-MM-DDTHH:mm:ss.sssZ).
   */
  readonly timestamp: string;
  /**
   * Optional contextual parameters related to the error (e.g. driverId, state values).
   */
  readonly details?: Record<string, any>;
}
