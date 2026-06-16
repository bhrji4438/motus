import { ErrorCode, MotusError } from "@motus/types";

export class SocketIOTransportError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number = 400,
    public readonly details?: Record<string, any>,
    cause?: Error
  ) {
    super(message, { cause });
    this.name = "SocketIOTransportError";
  }

  public toMotusError(): MotusError {
    const error: any = {
      code: this.code,
      message: this.message,
      timestamp: new Date().toISOString(),
    };

    if (this.cause) {
      error.cause = (this.cause as Error).message;
    }

    if (this.details) {
      error.details = this.details;
    }

    return error as MotusError;
  }
}

export function createUnauthorizedError(
  message: string,
  details?: Record<string, any>
): SocketIOTransportError {
  return new SocketIOTransportError(
    ErrorCode.MOTUS_UNAUTHORIZED,
    message,
    401,
    details
  );
}

export function createInvalidArgumentError(
  message: string,
  details?: Record<string, any>
): SocketIOTransportError {
  return new SocketIOTransportError(
    ErrorCode.MOTUS_INVALID_ARGUMENT,
    message,
    400,
    details
  );
}

export function createInternalError(
  message: string,
  details?: Record<string, any>,
  cause?: Error
): SocketIOTransportError {
  return new SocketIOTransportError(
    ErrorCode.MOTUS_INTERNAL_ERROR,
    message,
    500,
    details,
    cause
  );
}
