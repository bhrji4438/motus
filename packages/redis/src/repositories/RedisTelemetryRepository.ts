import type { TenantId, SessionId, TelemetryPoint } from '@motus/types';
import type { RedisClient } from '@/client/RedisClientManager.js';
import { KeyFactory } from '@/keys/KeyFactory.js';
import { TenantGuard } from '@/guards/TenantGuard.js';
import { TelemetrySerializer } from '@/serialization/Serializer.js';
import type { RedisStreamsConfig } from '@/config/index.js';
import { DEFAULT_STREAMS_CONFIG } from '@/config/index.js';
import {
  resolveObservability,
  withObservability,
  type RedisObservabilityDeps,
} from '@/observability/RedisObservability.js';

export interface GetTelemetryOptions {
  from?: string;
  to?: string;
  limit?: number;
}

/**
 * Domain-aware repository for session telemetry streams.
 *
 * Owned structure: `tenant:{tenantId}:session:{sessionId}:telemetry`
 *
 * AT_MOST_ONCE delivery: failures are dropped with a warning (real-time data).
 */
export class RedisTelemetryRepository {
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
   * Appends a telemetry point to the session stream.
   * Returns the Redis stream ID. On failure: drops if telemetryDropOnFailure, else retries.
   */
  async appendTelemetry(tenantId: TenantId, sessionId: SessionId, point: TelemetryPoint): Promise<string> {
    TenantGuard.validate(tenantId);
    TenantGuard.validateSessionId(sessionId);
    const key = KeyFactory.sessionTelemetryStream(tenantId, sessionId);
    const fields = TelemetrySerializer.serializeToStream(point);

    return withObservability(this.obs, 'RedisTelemetryRepository.appendTelemetry', async () => {
      const args: string[] = [];
      for (const [f, v] of Object.entries(fields)) {
        args.push(f, v);
      }

      if (this.streams.telemetryDropOnFailure) {
        try {
          const id = await (this.client as any).xadd(key, '*', ...args) as string;
          this.obs.metrics.incrementStreamAppend('telemetry');
          return id;
        } catch (err) {
          this.obs.logger.warn(`Telemetry point dropped (AT_MOST_ONCE)`, {
            tenantId, sessionId, error: err,
          });
          return '';
        }
      } else {
        // Retry path
        let lastError: unknown;
        for (let attempt = 1; attempt <= this.streams.eventAppendMaxRetries; attempt++) {
          try {
            const id = await (this.client as any).xadd(key, '*', ...args) as string;
            this.obs.metrics.incrementStreamAppend('telemetry');
            return id;
          } catch (err) {
            lastError = err;
            if (attempt < this.streams.eventAppendMaxRetries) {
              await new Promise(r => setTimeout(r, this.streams.eventAppendRetryDelayMs * attempt));
            }
          }
        }
        throw lastError;
      }
    });
  }

  /** Returns telemetry points within an optional stream ID range. */
  async getTelemetryPath(
    tenantId: TenantId,
    sessionId: SessionId,
    options?: GetTelemetryOptions
  ): Promise<TelemetryPoint[]> {
    TenantGuard.validate(tenantId);
    TenantGuard.validateSessionId(sessionId);
    const key = KeyFactory.sessionTelemetryStream(tenantId, sessionId);

    return withObservability(this.obs, 'RedisTelemetryRepository.getTelemetryPath', async () => {
      const from = options?.from ?? '-';
      const to = options?.to ?? '+';
      const limit = options?.limit;

      let entries: Array<[string, string[]]>;
      if (limit !== undefined) {
        entries = await (this.client as any).xrange(key, from, to, 'COUNT', limit) as Array<[string, string[]]>;
      } else {
        entries = await (this.client as any).xrange(key, from, to) as Array<[string, string[]]>;
      }

      return entries.map(([, entryFields]) => {
        const parsed: Record<string, string> = {};
        for (let i = 0; i < entryFields.length; i += 2) {
          parsed[entryFields[i]] = entryFields[i + 1];
        }
        return TelemetrySerializer.deserializeFromStream(parsed);
      });
    });
  }

  /** Returns the N most recent telemetry points in reverse chronological order. */
  async getRecentTelemetry(
    tenantId: TenantId,
    sessionId: SessionId,
    count: number
  ): Promise<TelemetryPoint[]> {
    TenantGuard.validate(tenantId);
    TenantGuard.validateSessionId(sessionId);
    const key = KeyFactory.sessionTelemetryStream(tenantId, sessionId);

    return withObservability(this.obs, 'RedisTelemetryRepository.getRecentTelemetry', async () => {
      const entries = await (this.client as any).xrevrange(key, '+', '-', 'COUNT', count) as Array<[string, string[]]>;
      return entries.map(([, entryFields]) => {
        const parsed: Record<string, string> = {};
        for (let i = 0; i < entryFields.length; i += 2) {
          parsed[entryFields[i]] = entryFields[i + 1];
        }
        return TelemetrySerializer.deserializeFromStream(parsed);
      });
    });
  }

  /** Returns the total number of telemetry entries in the stream. */
  async countTelemetryPoints(tenantId: TenantId, sessionId: SessionId): Promise<number> {
    TenantGuard.validate(tenantId);
    TenantGuard.validateSessionId(sessionId);
    const key = KeyFactory.sessionTelemetryStream(tenantId, sessionId);
    return withObservability(this.obs, 'RedisTelemetryRepository.countTelemetryPoints', async () => {
      return (this.client as any).xlen(key) as Promise<number>;
    });
  }

  /** Trims the telemetry stream to the most recent maxLen entries. */
  async trimTelemetry(tenantId: TenantId, sessionId: SessionId, maxLen: number, exact = false): Promise<void> {
    TenantGuard.validate(tenantId);
    TenantGuard.validateSessionId(sessionId);
    const key = KeyFactory.sessionTelemetryStream(tenantId, sessionId);
    await withObservability(this.obs, 'RedisTelemetryRepository.trimTelemetry', async () => {
      if (exact) {
        await (this.client as any).xtrim(key, 'MAXLEN', maxLen);
      } else {
        await (this.client as any).xtrim(key, 'MAXLEN', '~', maxLen);
      }
    });
  }

  /** Deletes the telemetry stream entirely (called by cleanup service). */
  async deleteTelemetry(tenantId: TenantId, sessionId: SessionId): Promise<void> {
    TenantGuard.validate(tenantId);
    TenantGuard.validateSessionId(sessionId);
    const key = KeyFactory.sessionTelemetryStream(tenantId, sessionId);
    await withObservability(this.obs, 'RedisTelemetryRepository.deleteTelemetry', async () => {
      await (this.client as any).del(key);
      this.obs.metrics.recordCleanupPruned('telemetry', 1);
    });
  }
}
