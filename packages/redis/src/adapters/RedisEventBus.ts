import type { IEventBus } from "@motus/core";
import type { MotusEvent, TenantId } from "@motus/types";
import type { RedisClientManager } from "@/client/RedisClientManager.js";
import { KeyFactory } from "@/keys/KeyFactory.js";
import { TenantGuard } from "@/guards/TenantGuard.js";
import { EventGovernanceValidator } from "@/governance/EventGovernanceValidator.js";
import { RedisEventRepository } from "@/repositories/RedisEventRepository.js";
import type { RedisPubSubConfig, RedisStreamsConfig } from "@/config/index.js";
import {
  DEFAULT_PUBSUB_CONFIG,
  DEFAULT_STREAMS_CONFIG,
} from "@/config/index.js";
import {
  resolveObservability,
  withObservability,
  type RedisObservabilityDeps,
} from "@/observability/RedisObservability.js";

type EventHandler = (event: MotusEvent) => void | Promise<void>;

/**
 * Redis Pub/Sub implementation of IEventBus.
 *
 * Architecture:
 * - Publisher connection: issues PUBLISH commands.
 * - Subscriber connection: dedicated to SUBSCRIBE / PSUBSCRIBE (cannot issue other commands).
 *
 * Governance:
 * - Every published event is validated by EventGovernanceValidator before PUBLISH.
 * - AT_LEAST_ONCE events are also written to the event stream via RedisEventRepository.
 * - AT_MOST_ONCE events are published to Pub/Sub only.
 */
export class RedisEventBus implements IEventBus {
  private readonly obs;
  private readonly pubsub: RedisPubSubConfig;
  private readonly subscriptions: Map<string, Set<EventHandler>> = new Map();
  private eventRepo?: RedisEventRepository;

  constructor(
    private readonly manager: RedisClientManager,
    pubsub: RedisPubSubConfig = DEFAULT_PUBSUB_CONFIG,
    streams: RedisStreamsConfig = DEFAULT_STREAMS_CONFIG,
    deps?: RedisObservabilityDeps
  ) {
    this.obs = resolveObservability(deps);
    this.pubsub = pubsub;
    // Event repository for AT_LEAST_ONCE stream durability
    this.eventRepo = new RedisEventRepository(manager.client, streams, deps);
  }

  /**
   * Publishes a MotusEvent after full governance validation.
   * AT_LEAST_ONCE events are additionally appended to the event stream.
   */
  async publish(event: MotusEvent): Promise<void> {
    // Governance validation — throws on any violation
    EventGovernanceValidator.validate(event, (warnMsg) => {
      this.obs.logger.warn(warnMsg);
    });

    const channel = KeyFactory.pubSubChannel(
      this.pubsub.channelPrefix,
      event.tenantId,
      event.eventName
    );

    const payload = JSON.stringify(event);

    // Enforce message size limit
    if (Buffer.byteLength(payload, "utf8") > this.pubsub.maxMessageSizeBytes) {
      this.obs.logger.warn(`Event exceeds maxMessageSizeBytes, dropping`, {
        eventName: event.eventName,
        tenantId: event.tenantId,
        eventId: event.eventId,
        sizeBytes: Buffer.byteLength(payload, "utf8"),
      });
      return;
    }

    await withObservability(this.obs, "RedisEventBus.publish", async () => {
      // Pub/Sub publish
      await (this.manager.client as any).publish(channel, payload);
      this.obs.metrics.recordPubSubPublish(channel);

      // AT_LEAST_ONCE — also write to durable event stream
      if (
        event.governance.deliveryGuarantee === "AT_LEAST_ONCE" &&
        this.eventRepo
      ) {
        const sessionEvent = {
          eventId: event.eventId,
          eventName: event.eventName,
          timestamp: event.timestamp,
          payload: event.payload as unknown as Record<string, unknown>,
        };
        // Session ID may not always be available; use a fallback key
        const sessionId = (event.payload as any)?.sessionId ?? "_global";
        try {
          await this.eventRepo.appendEvent(
            event.tenantId,
            sessionId,
            sessionEvent
          );
        } catch (err) {
          // Do not block Pub/Sub publish if stream append fails
          this.obs.logger.error(`AT_LEAST_ONCE stream write failed`, {
            eventId: event.eventId,
            error: err,
          });
        }
      }
    });

    this.obs.logger.debug(`Event published`, {
      channel,
      eventName: event.eventName,
      eventId: event.eventId,
      deliveryGuarantee: event.governance.deliveryGuarantee,
    });
  }

  /**
   * Subscribes to a specific event name within a tenant.
   * Internally uses SUBSCRIBE on the exact channel.
   */
  async subscribe(
    tenantId: TenantId,
    eventName: string,
    handler: EventHandler
  ): Promise<void> {
    TenantGuard.validate(tenantId);
    const channel = KeyFactory.pubSubChannel(
      this.pubsub.channelPrefix,
      tenantId,
      eventName
    );
    await this.addSubscription(channel, false, handler);
  }

  /**
   * Subscribes to all events for a tenant using a pattern (PSUBSCRIBE).
   */
  async subscribeAll(tenantId: TenantId, handler: EventHandler): Promise<void> {
    TenantGuard.validate(tenantId);
    if (!this.pubsub.enablePatternSubscribe) {
      this.obs.logger.warn(
        "Pattern subscribe disabled in config; subscribeAll is a no-op"
      );
      return;
    }
    const pattern = KeyFactory.pubSubTenantWildcard(
      this.pubsub.channelPrefix,
      tenantId
    );
    await this.addSubscription(pattern, true, handler);
  }

  /**
   * Unsubscribes a specific handler from a channel.
   */
  async unsubscribe(
    tenantId: TenantId,
    eventName: string,
    handler: EventHandler
  ): Promise<void> {
    TenantGuard.validate(tenantId);
    const channel = KeyFactory.pubSubChannel(
      this.pubsub.channelPrefix,
      tenantId,
      eventName
    );
    const handlers = this.subscriptions.get(channel);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.subscriptions.delete(channel);
        await (this.manager.subscriberClient as any).unsubscribe(channel);
      }
    }
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private async addSubscription(
    channelOrPattern: string,
    isPattern: boolean,
    handler: EventHandler
  ): Promise<void> {
    const isNew = !this.subscriptions.has(channelOrPattern);

    if (isNew) {
      this.subscriptions.set(channelOrPattern, new Set());
      const sub = this.manager.subscriberClient;

      if (isPattern) {
        await (sub as any).psubscribe(channelOrPattern);
        sub.on(
          "pmessage",
          (_pattern: string, channel: string, message: string) => {
            this.handleMessage(channel, message, channelOrPattern);
          }
        );
      } else {
        await (sub as any).subscribe(channelOrPattern);
        sub.on("message", (channel: string, message: string) => {
          this.handleMessage(channel, message, channel);
        });
      }
    }

    this.subscriptions.get(channelOrPattern)!.add(handler);
  }

  private handleMessage(
    channel: string,
    message: string,
    subscriptionKey: string
  ): void {
    // Enforce message size limit
    if (Buffer.byteLength(message, "utf8") > this.pubsub.maxMessageSizeBytes) {
      this.obs.logger.warn(`Received oversized message, dropping`, { channel });
      return;
    }

    let event: MotusEvent;
    try {
      event = JSON.parse(message) as MotusEvent;
    } catch (err) {
      this.obs.logger.error(`Failed to parse pub/sub message`, {
        channel,
        error: err,
      });
      return;
    }

    // Optional governance validation on receive
    if (this.pubsub.enforceGovernanceOnReceive) {
      try {
        EventGovernanceValidator.validate(event, (warnMsg) =>
          this.obs.logger.warn(warnMsg)
        );
      } catch (err) {
        this.obs.logger.warn(
          `Received event failed governance validation, dropping`,
          {
            channel,
            error: (err as Error).message,
          }
        );
        return;
      }
    }

    this.obs.metrics.recordPubSubReceived(channel);

    const handlers = this.subscriptions.get(subscriptionKey);
    if (!handlers) return;

    for (const handler of handlers) {
      Promise.resolve(handler(event)).catch((err) => {
        this.obs.logger.error(`Event handler threw an error`, {
          channel,
          error: err,
        });
      });
    }
  }
}
