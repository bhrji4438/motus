import { ErrorCode } from "@motus/types";

export const RETRYABLE_ERRORS = new Set<ErrorCode>([
  ErrorCode.MOTUS_DRIVER_BUSY,
  ErrorCode.MOTUS_CAPACITY_EXCEEDED,
  ErrorCode.MOTUS_LOCK_ACQUISITION_FAILED,
  ErrorCode.MOTUS_INTERNAL_ERROR,
]);

export function isErrorCodeRetryable(code: ErrorCode): boolean {
  return RETRYABLE_ERRORS.has(code);
}
