import type { ISessionRepository } from "@motus/core";
import type { Session, TenantId, SessionId } from "@motus/types";
import type { RedisClient } from "@/client/RedisClientManager.js";
import { KeyFactory } from "@/keys/KeyFactory.js";
import { TenantGuard } from "@/guards/TenantGuard.js";
import {
  SessionSerializer,
  TelemetrySerializer,
  EventStreamSerializer,
} from "@/serialization/Serializer.js";
import type { RedisRetentionConfig } from "@/config/index.js";
import { DEFAULT_RETENTION_CONFIG } from "@/config/index.js";
import {
  resolveObservability,
  withObservability,
  type RedisObservabilityDeps,
} from "@/observability/RedisObservability.js";

const TERMINAL_STATES: Set<string> = new Set(["COMPLETED", "CANCELLED"]);

/**
 * Redis-backed implementation of ISessionRepository.
 *
 * Storage layout:
 * - Hash:   `tenant:{tenantId}:session:{sessionId}` — core session metadata + waves
 * - Stream: `tenant:{tenantId}:session:{sessionId}:telemetry` — telemetry points (hydrated on GET)
 * - Stream: `tenant:{tenantId}:session:{sessionId}:events`    — session events (hydrated on GET)
 * - ZSET:   `motus:sessions:expiry`                           — expiry registry (written on terminal save)
 */
export class RedisSessionRepository implements ISessionRepository {
  private readonly obs;
  private readonly retention: RedisRetentionConfig;

  constructor(
    private readonly client: RedisClient,
    retention: RedisRetentionConfig = DEFAULT_RETENTION_CONFIG,
    deps?: RedisObservabilityDeps
  ) {
    this.obs = resolveObservability(deps);
    this.retention = retention;
  }

  async save(
    session: Session & { requiredVehicleType?: string }
  ): Promise<void> {
    TenantGuard.validate(session.tenantId);
    TenantGuard.validateSessionId(session.id);

    const hashKey = KeyFactory.sessionHash(session.tenantId, session.id);
    const fields = SessionSerializer.serialize(session);

    await withObservability(
      this.obs,
      "RedisSessionRepository.save",
      async () => {
        const args: string[] = [];
        for (const [f, v] of Object.entries(fields)) {
          args.push(f, v);
        }
        await (this.client as any).hset(hashKey, ...args);

        // Register in expiry ZSET when session reaches a terminal state
        if (TERMINAL_STATES.has(session.status as string)) {
          const expiryScore =
            Date.now() + this.retention.sessionRetentionSeconds * 1000;
          const member = KeyFactory.sessionExpiryMember(
            session.tenantId,
            session.id
          );
          await (this.client as any).zadd(
            KeyFactory.sessionExpiryZset(),
            expiryScore,
            member
          );
          this.obs.logger.debug(`Session registered for expiry`, {
            tenantId: session.tenantId,
            sessionId: session.id,
            status: session.status,
            expiresAt: new Date(expiryScore).toISOString(),
          });
        }
      }
    );
  }

  async get(tenantId: TenantId, sessionId: SessionId): Promise<Session | null> {
    TenantGuard.validate(tenantId);
    TenantGuard.validateSessionId(sessionId);

    const hashKey = KeyFactory.sessionHash(tenantId, sessionId);
    const telemetryKey = KeyFactory.sessionTelemetryStream(tenantId, sessionId);
    const eventKey = KeyFactory.sessionEventStream(tenantId, sessionId);

    return withObservability(
      this.obs,
      "RedisSessionRepository.get",
      async () => {
        // Fetch session hash + both streams in a single pipeline
        const pipeline = (this.client as any).pipeline();
        pipeline.hgetall(hashKey);
        pipeline.xrange(telemetryKey, "-", "+");
        pipeline.xrange(eventKey, "-", "+");
        const results = (await pipeline.exec()) as [Error | null, unknown][];

        const [hashErr, hashFields] = results[0] as [
          Error | null,
          Record<string, string> | null
        ];
        if (hashErr || !hashFields || Object.keys(hashFields).length === 0) {
          this.obs.metrics.incrementCacheMiss("RedisSessionRepository");
          return null;
        }

        // Cross-tenant safety check
        if (hashFields["tenantId"] && hashFields["tenantId"] !== tenantId) {
          this.obs.logger.error(`Cross-tenant session access detected`, {
            requestedTenantId: tenantId,
            storedTenantId: hashFields["tenantId"],
            sessionId,
          });
          throw new Error(
            `MOTUS_UNAUTHORIZED: Cross-tenant session access denied for sessionId ${sessionId}`
          );
        }

        const session = SessionSerializer.deserialize(hashFields);

        // Hydrate telemetry path from stream
        const [, telemetryEntries] = results[1] as [
          Error | null,
          Array<[string, string[]]>
        ];
        if (Array.isArray(telemetryEntries)) {
          const telemetryPath = telemetryEntries.map(([, entryFields]) => {
            const parsed: Record<string, string> = {};
            for (let i = 0; i < entryFields.length; i += 2) {
              parsed[entryFields[i]] = entryFields[i + 1];
            }
            return TelemetrySerializer.deserializeFromStream(parsed);
          });
          (session as any).telemetryPath = telemetryPath;
        }

        // Hydrate event timeline from stream
        const [, eventEntries] = results[2] as [
          Error | null,
          Array<[string, string[]]>
        ];
        if (Array.isArray(eventEntries)) {
          const eventTimeline = eventEntries.map(([, entryFields]) => {
            const parsed: Record<string, string> = {};
            for (let i = 0; i < entryFields.length; i += 2) {
              parsed[entryFields[i]] = entryFields[i + 1];
            }
            return EventStreamSerializer.deserializeFromStream(parsed);
          });
          (session as any).eventTimeline = eventTimeline;
        }

        this.obs.metrics.incrementCacheHit("RedisSessionRepository");
        return session as Session;
      }
    );
  }
}
