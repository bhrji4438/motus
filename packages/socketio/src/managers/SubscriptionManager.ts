import { createInvalidArgumentError } from "@/errors/errors.js";
import { MetricsManager } from "@/observability/MetricsManager.js";

export class SubscriptionManager {
  private readonly socketSubscriptions = new Map<string, Set<string>>();

  constructor(private readonly metrics: MetricsManager) {}

  /**
   * Tracks a subscription to a room.
   * Returns true if newly subscribed, false if already subscribed.
   * Throws an error if subscription limits are exceeded.
   */
  public subscribe(
    socketId: string,
    room: string,
    maxSubscriptions: number
  ): boolean {
    if (!this.socketSubscriptions.has(socketId)) {
      this.socketSubscriptions.set(socketId, new Set());
    }

    const subscriptions = this.socketSubscriptions.get(socketId)!;

    if (subscriptions.has(room)) {
      return false; // Already subscribed (Duplicate protection)
    }

    if (subscriptions.size >= maxSubscriptions) {
      throw createInvalidArgumentError(
        `Subscription limit exceeded. Max allowed: ${maxSubscriptions}`
      );
    }

    subscriptions.add(room);
    this.metrics.logger.debug(`Subscription recorded for socket`, {
      socketId,
      room,
      total: subscriptions.size,
    });
    return true;
  }

  /**
   * Removes subscription tracking for a room.
   * Returns true if subscription existed and was removed, false otherwise.
   */
  public unsubscribe(socketId: string, room: string): boolean {
    const subscriptions = this.socketSubscriptions.get(socketId);
    if (!subscriptions || !subscriptions.has(room)) {
      return false;
    }

    subscriptions.delete(room);
    if (subscriptions.size === 0) {
      this.socketSubscriptions.delete(socketId);
    }

    this.metrics.logger.debug(`Subscription removed for socket`, {
      socketId,
      room,
    });
    return true;
  }

  public getSubscriptions(socketId: string): string[] {
    const subscriptions = this.socketSubscriptions.get(socketId);
    return subscriptions ? Array.from(subscriptions) : [];
  }

  public hasSubscription(socketId: string, room: string): boolean {
    return this.socketSubscriptions.get(socketId)?.has(room) ?? false;
  }

  public cleanup(socketId: string): void {
    const subscriptions = this.socketSubscriptions.get(socketId);
    if (subscriptions) {
      this.socketSubscriptions.delete(socketId);
      this.metrics.logger.debug(`All subscriptions cleared for socket`, {
        socketId,
        count: subscriptions.size,
      });
    }
  }

  public clear(): void {
    this.socketSubscriptions.clear();
  }
}
