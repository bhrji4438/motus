import { IEventBus } from '@/internal/interfaces/ports.js';
import { MotusEvent } from '@motus/types';
import { EventValidator } from '@/internal/events/EventValidator.js';

export class EventDispatcher implements IEventBus {
  private readonly validator = new EventValidator();
  private readonly listeners = new Map<string, Set<(event: any) => void | Promise<void>>>();

  public on(eventPattern: string, handler: (event: any) => void | Promise<void>): void {
    if (!this.listeners.has(eventPattern)) {
      this.listeners.set(eventPattern, new Set());
    }
    this.listeners.get(eventPattern)!.add(handler);
  }

  public off(eventPattern: string, handler: (event: any) => void | Promise<void>): void {
    const set = this.listeners.get(eventPattern);
    if (set) {
      set.delete(handler);
      if (set.size === 0) {
        this.listeners.delete(eventPattern);
      }
    }
  }

  public once(eventPattern: string, handler: (event: any) => void | Promise<void>): void {
    const wrapped = async (event: any) => {
      this.off(eventPattern, wrapped);
      await handler(event);
    };
    this.on(eventPattern, wrapped);
  }

  public async publish(event: MotusEvent): Promise<void> {
    // 1. Validate event schema/governance
    this.validator.validate(event);

    // 2. Locate all registered handlers whose patterns match this event's name
    const handlersToInvoke: ((event: any) => void | Promise<void>)[] = [];

    for (const [pattern, set] of this.listeners.entries()) {
      if (this.matchPattern(event.eventName, pattern)) {
        handlersToInvoke.push(...set);
      }
    }

    // 3. Dispatch to all handlers concurrently and safely handle exceptions
    const promises = handlersToInvoke.map(async (handler) => {
      try {
        await handler(event);
      } catch {
        // Discard or log errors to prevent failing subscribers from disrupting other subscribers
      }
    });

    await Promise.all(promises);
  }

  private matchPattern(eventName: string, pattern: string): boolean {
    if (pattern === '*' || pattern === '**') {
      return true;
    }
    if (pattern === eventName) {
      return true;
    }
    // Simple glob matching support (e.g. driver.* matches driver.online, driver.offline)
    const regexStr = '^' + pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // escape special regex characters
      .replace(/\*/g, '.*') + '$';
    const regex = new RegExp(regexStr);
    return regex.test(eventName);
  }
}
