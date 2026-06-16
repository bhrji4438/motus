import { AsyncLocalStorage } from "async_hooks";
import crypto from "crypto";

export interface ICorrelationContext {
  correlationId: string;
  tenantId?: string;
  sessionId?: string;
  [key: string]: any;
}

export class CorrelationContext {
  private static storage = new AsyncLocalStorage<ICorrelationContext>();

  /**
   * Run a function within a correlation context context.
   */
  public static run<T>(context: Partial<ICorrelationContext>, fn: () => T): T {
    const correlationId = context.correlationId || this.generateId();
    const mergedContext: ICorrelationContext = {
      ...this.getStore(),
      ...context,
      correlationId,
    };
    return this.storage.run(mergedContext, fn);
  }

  /**
   * Retrieve the current context store.
   */
  public static getStore(): ICorrelationContext | undefined {
    return this.storage.getStore();
  }

  /**
   * Get the current correlation ID, fallback to generating one if context is missing.
   */
  public static getCorrelationId(): string {
    const store = this.getStore();
    return store?.correlationId || this.generateId();
  }

  /**
   * Get the current tenant ID if available.
   */
  public static getTenantId(): string | undefined {
    return this.getStore()?.tenantId;
  }

  /**
   * Get the current session ID if available.
   */
  public static getSessionId(): string | undefined {
    return this.getStore()?.sessionId;
  }

  /**
   * Generate a random correlation/request ID.
   */
  public static generateId(): string {
    return crypto.randomUUID();
  }
}
