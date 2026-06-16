import pino, { Logger as PinoInstance, LoggerOptions } from "pino";
import { ILogger } from "@motus/core";
import { CorrelationContext } from "@/logger/CorrelationContext.js";

export class Logger implements ILogger {
  private pino: PinoInstance;

  constructor(options: LoggerOptions = {}) {
    this.pino = pino({
      level: process.env.LOG_LEVEL || "info",
      formatters: {
        level: (label) => ({ level: label.toUpperCase() }),
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      ...options,
    });
  }

  private getContext(): Record<string, any> {
    const store = CorrelationContext.getStore();
    if (!store) {
      return { correlationId: CorrelationContext.getCorrelationId() };
    }
    return {
      correlationId: store.correlationId,
      tenantId: store.tenantId,
      sessionId: store.sessionId,
    };
  }

  public debug(message: string, ...args: any[]): void {
    const context = this.getContext();
    this.pino.debug(context, message, ...args);
  }

  public info(message: string, ...args: any[]): void {
    const context = this.getContext();
    this.pino.info(context, message, ...args);
  }

  public warn(message: string, ...args: any[]): void {
    const context = this.getContext();
    this.pino.warn(context, message, ...args);
  }

  public error(message: string, ...args: any[]): void {
    const context = this.getContext();
    // If the first argument in args is an Error instance, serialize it
    const errorObj = args.find((arg) => arg instanceof Error);
    if (errorObj) {
      this.pino.error(
        { ...context, err: errorObj },
        message,
        ...args.filter((a) => a !== errorObj)
      );
    } else {
      this.pino.error(context, message, ...args);
    }
  }

  public trace(message: string, ...args: any[]): void {
    const context = this.getContext();
    this.pino.trace(context, message, ...args);
  }

  public fatal(message: string, ...args: any[]): void {
    const context = this.getContext();
    this.pino.fatal(context, message, ...args);
  }

  public child(bindings: Record<string, any>): Logger {
    const childPino = this.pino.child(bindings);
    const childLogger = new Logger();
    childLogger.pino = childPino;
    return childLogger;
  }
}

// Global default logger instance
export const logger = new Logger();
export default logger;
