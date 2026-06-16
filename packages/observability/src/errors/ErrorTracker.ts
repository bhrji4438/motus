import { trace } from "@opentelemetry/api";
import { logger } from "@/logger/Logger.js";

export type ErrorHook = (
  error: Error,
  context?: Record<string, any>
) => void | Promise<void>;

export class ErrorTracker {
  private static hooks: ErrorHook[] = [];

  /**
   * Register a custom error tracking hook (e.g. Sentry, Rollbar, etc.)
   */
  public static registerHook(hook: ErrorHook): void {
    this.hooks.push(hook);
  }

  /**
   * Clear all registered error hooks.
   */
  public static clearHooks(): void {
    this.hooks = [];
  }

  /**
   * Capture a runtime exception, log it, attach it to the active OTel span, and run registered hooks.
   */
  public static captureException(
    error: Error,
    message: string = "An unhandled exception occurred",
    context: Record<string, any> = {}
  ): void {
    // 1. Get active OpenTelemetry span and record the exception
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      activeSpan.recordException(error);
      activeSpan.setStatus({
        code: 2, // Error
        message: error.message || message,
      });
      // Attach context as span attributes
      Object.entries(context).forEach(([key, val]) => {
        activeSpan.setAttribute(`error.context.${key}`, String(val));
      });
    }

    // 2. Log standard JSON structured log
    logger.error(message, error, {
      ...context,
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack,
    });

    // 3. Execute custom registered hooks
    for (const hook of this.hooks) {
      try {
        const result = hook(error, context);
        if (result instanceof Promise) {
          result.catch((hookError) => {
            logger.warn("Error hook execution failed", hookError);
          });
        }
      } catch (hookError) {
        logger.warn("Error hook execution failed", hookError);
      }
    }
  }
}
