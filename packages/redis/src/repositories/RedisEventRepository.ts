import type { TenantId, SessionId, SessionEvent } from "@motus/types";
import type { RedisClient } from "@/client/RedisClientManager.js";
import { KeyFactory } from "@/keys/KeyFactory.js";
import { TenantGuard } from "@/guards/TenantGuard.js";
import { EventStreamSerializer } from "@/serialization/Serializer.js";
import type { RedisStreamsConfig } from "@/config/index.js";
import { DEFAULT_STREAMS_CONFIG } from "@/config/index.js";
import {
  resolveObservability,
  withObservability,
  type RedisObservabilityDeps,
} from "@/observability/RedisObservability.js";

export interface GetEventsOptions {
  from?: string; // Stream ID (inclusive)
  to?: string; // Stream ID (inclusive)
  limit?: number;
}

/**
 * Domain-aware repository for session event streams.
 *
 * Owned structure: `tenant:{tenantId}:session:{sessionId}:events`
 *
 * AT_LEAST_ONCE delivery guarantee: XADD is retried on failure.
 */
export class RedisEventRepository {
  private readonly obs;
  private readonly streams: RedisStreamsConfig;

  constructor(
    private readonly client: RedisClient,
    streams: RedisStreamsConfig = DEFAULT_STREAMS_CONFIG,
    deps?: RedisObservabilityDeps
  ) {
    this.obs = resolveObservability(deps);
    this.streams = streams;
  }

  /**
   * Appends a session event to the stream with AT_LEAST_ONCE delivery.
   * Returns the Redis stream ID of the appended entry.
   */
  async appendEvent(
    tenantId: TenantId,
    sessionId: SessionId,
    event: SessionEvent
  ): Promise<string> {
    TenantGuard.validate(tenantId);
    TenantGuard.validateSessionId(sessionId);
    const key = KeyFactory.sessionEventStream(tenantId, sessionId);
    const fields = EventStreamSerializer.serializeToStream(event);

    return withObservability(
      this.obs,
      "RedisEventRepository.appendEvent",
      async () => {
        let lastError: unknown;
        for (
          let attempt = 1;
          attempt <= this.streams.eventAppendMaxRetries;
          attempt++
        ) {
          try {
            const args: string[] = [];
            for (const [f, v] of Object.entries(fields)) {
              args.push(f, v);
            }
            const streamId = (await (this.client as any).xadd(
              key,
              "*",
              ...args
            )) as string;
            this.obs.metrics.incrementStreamAppend("event");
            return streamId;
          } catch (err) {
            lastError = err;
            if (attempt < this.streams.eventAppendMaxRetries) {
              await new Promise((r) =>
                setTimeout(r, this.streams.eventAppendRetryDelayMs * attempt)
              );
            }
          }
        }
        this.obs.logger.error(
          `Failed to append event after ${this.streams.eventAppendMaxRetries} attempts`,
          {
            tenantId,
            sessionId,
            eventId: event.eventId,
            error: lastError,
          }
        );
        throw lastError;
      }
    );
  }

  /** Reads events from the stream within an optional range and limit. */
  async getEvents(
    tenantId: TenantId,
    sessionId: SessionId,
    options?: GetEventsOptions
  ): Promise<SessionEvent[]> {
    TenantGuard.validate(tenantId);
    TenantGuard.validateSessionId(sessionId);
    const key = KeyFactory.sessionEventStream(tenantId, sessionId);

    return withObservability(
      this.obs,
      "RedisEventRepository.getEvents",
      async () => {
        const from = options?.from ?? "-";
        const to = options?.to ?? "+";
        const limit = options?.limit;

        let entries: Array<[string, string[]]>;
        if (limit !== undefined) {
          entries = (await (this.client as any).xrange(
            key,
            from,
            to,
            "COUNT",
            limit
          )) as Array<[string, string[]]>;
        } else {
          entries = (await (this.client as any).xrange(key, from, to)) as Array<
            [string, string[]]
          >;
        }

        return entries.map(([, entryFields]) => {
          const parsed: Record<string, string> = {};
          for (let i = 0; i < entryFields.length; i += 2) {
            parsed[entryFields[i]] = entryFields[i + 1];
          }
          return EventStreamSerializer.deserializeFromStream(parsed);
        });
      }
    );
  }

  /** Returns the full event timeline for a session (unbound). */
  async getEventTimeline(
    tenantId: TenantId,
    sessionId: SessionId
  ): Promise<SessionEvent[]> {
    return this.getEvents(tenantId, sessionId);
  }

  /** Returns the N most recent events in reverse chronological order. */
  async getRecentEvents(
    tenantId: TenantId,
    sessionId: SessionId,
    count: number
  ): Promise<SessionEvent[]> {
    TenantGuard.validate(tenantId);
    TenantGuard.validateSessionId(sessionId);
    const key = KeyFactory.sessionEventStream(tenantId, sessionId);

    return withObservability(
      this.obs,
      "RedisEventRepository.getRecentEvents",
      async () => {
        const entries = (await (this.client as any).xrevrange(
          key,
          "+",
          "-",
          "COUNT",
          count
        )) as Array<[string, string[]]>;
        return entries.map(([, entryFields]) => {
          const parsed: Record<string, string> = {};
          for (let i = 0; i < entryFields.length; i += 2) {
            parsed[entryFields[i]] = entryFields[i + 1];
          }
          return EventStreamSerializer.deserializeFromStream(parsed);
        });
      }
    );
  }

  /** Returns the total number of entries in the event stream. */
  async countEvents(tenantId: TenantId, sessionId: SessionId): Promise<number> {
    TenantGuard.validate(tenantId);
    TenantGuard.validateSessionId(sessionId);
    const key = KeyFactory.sessionEventStream(tenantId, sessionId);
    return withObservability(
      this.obs,
      "RedisEventRepository.countEvents",
      async () => {
        return (this.client as any).xlen(key) as Promise<number>;
      }
    );
  }

  /** Trims the event stream to the most recent maxLen entries. */
  async trimEvents(
    tenantId: TenantId,
    sessionId: SessionId,
    maxLen: number,
    exact = false
  ): Promise<void> {
    TenantGuard.validate(tenantId);
    TenantGuard.validateSessionId(sessionId);
    const key = KeyFactory.sessionEventStream(tenantId, sessionId);
    await withObservability(
      this.obs,
      "RedisEventRepository.trimEvents",
      async () => {
        if (exact) {
          await (this.client as any).xtrim(key, "MAXLEN", maxLen);
        } else {
          await (this.client as any).xtrim(key, "MAXLEN", "~", maxLen);
        }
      }
    );
  }

  /** Deletes the entire event stream (called by cleanup service on session prune). */
  async deleteEvents(tenantId: TenantId, sessionId: SessionId): Promise<void> {
    TenantGuard.validate(tenantId);
    TenantGuard.validateSessionId(sessionId);
    const key = KeyFactory.sessionEventStream(tenantId, sessionId);
    await withObservability(
      this.obs,
      "RedisEventRepository.deleteEvents",
      async () => {
        await (this.client as any).del(key);
        this.obs.metrics.recordCleanupPruned("event", 1);
      }
    );
  }
}
