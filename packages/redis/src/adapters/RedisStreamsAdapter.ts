import type { RedisClient } from "@/client/RedisClientManager.js";
import type { RedisStreamsConfig } from "@/config/index.js";
import { DEFAULT_STREAMS_CONFIG } from "@/config/index.js";
import {
  resolveObservability,
  withObservability,
  type RedisObservabilityDeps,
} from "@/observability/RedisObservability.js";

export interface StreamEntry {
  id: string;
  fields: Record<string, string>;
}

export interface ConsumerGroupReadOptions {
  group: string;
  consumer: string;
  count?: number;
  block?: number; // ms
}

/**
 * Low-level Redis Streams adapter providing raw XADD, XRANGE, XREVRANGE,
 * XREADGROUP, XCLAIM, and XTRIM operations.
 *
 * Higher-level repositories (RedisEventRepository, RedisTelemetryRepository)
 * build on top of this adapter.
 */
export class RedisStreamsAdapter {
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

  /** Appends an entry to a stream. Returns the auto-generated stream ID. */
  async xadd(key: string, fields: Record<string, string>): Promise<string> {
    return withObservability(this.obs, "RedisStreamsAdapter.xadd", async () => {
      const args: string[] = [];
      for (const [f, v] of Object.entries(fields)) {
        args.push(f, v);
      }
      return (this.client as any).xadd(key, "*", ...args) as Promise<string>;
    });
  }

  /** Reads entries from a stream in ascending order (oldest first). */
  async xrange(
    key: string,
    from: string,
    to: string,
    count?: number
  ): Promise<StreamEntry[]> {
    return withObservability(
      this.obs,
      "RedisStreamsAdapter.xrange",
      async () => {
        let raw: Array<[string, string[]]>;
        if (count !== undefined) {
          raw = (await (this.client as any).xrange(
            key,
            from,
            to,
            "COUNT",
            count
          )) as Array<[string, string[]]>;
        } else {
          raw = (await (this.client as any).xrange(key, from, to)) as Array<
            [string, string[]]
          >;
        }
        return RedisStreamsAdapter.parseEntries(raw);
      }
    );
  }

  /** Reads entries from a stream in descending order (newest first). */
  async xrevrange(
    key: string,
    from: string,
    to: string,
    count?: number
  ): Promise<StreamEntry[]> {
    return withObservability(
      this.obs,
      "RedisStreamsAdapter.xrevrange",
      async () => {
        let raw: Array<[string, string[]]>;
        if (count !== undefined) {
          raw = (await (this.client as any).xrevrange(
            key,
            from,
            to,
            "COUNT",
            count
          )) as Array<[string, string[]]>;
        } else {
          raw = (await (this.client as any).xrevrange(key, from, to)) as Array<
            [string, string[]]
          >;
        }
        return RedisStreamsAdapter.parseEntries(raw);
      }
    );
  }

  /** Returns the number of entries in a stream. */
  async xlen(key: string): Promise<number> {
    return withObservability(this.obs, "RedisStreamsAdapter.xlen", async () => {
      return (this.client as any).xlen(key) as Promise<number>;
    });
  }

  /** Trims a stream to at most maxLen entries. */
  async xtrim(key: string, maxLen: number, exact = false): Promise<void> {
    await withObservability(this.obs, "RedisStreamsAdapter.xtrim", async () => {
      if (exact) {
        await (this.client as any).xtrim(key, "MAXLEN", maxLen);
      } else {
        await (this.client as any).xtrim(key, "MAXLEN", "~", maxLen);
      }
    });
  }

  /**
   * Ensures a consumer group exists for the given stream.
   * Creates the stream with $ (last entry) if it doesn't exist.
   */
  async ensureConsumerGroup(
    streamKey: string,
    groupName: string
  ): Promise<void> {
    try {
      await (this.client as any).xgroup(
        "CREATE",
        streamKey,
        groupName,
        "$",
        "MKSTREAM"
      );
    } catch (err: any) {
      // BUSYGROUP means the group already exists — that's fine.
      if (!err?.message?.includes("BUSYGROUP")) {
        throw err;
      }
    }
  }

  /** Reads entries from a consumer group (XREADGROUP). */
  async xreadgroup(
    streamKey: string,
    options: ConsumerGroupReadOptions
  ): Promise<StreamEntry[]> {
    return withObservability(
      this.obs,
      "RedisStreamsAdapter.xreadgroup",
      async () => {
        const count = options.count ?? this.streams.readBatchSize;
        let raw: Array<[string, Array<[string, string[]]>]> | null;

        if (options.block !== undefined) {
          raw = (await (this.client as any).xreadgroup(
            "GROUP",
            options.group,
            options.consumer,
            "COUNT",
            count,
            "BLOCK",
            options.block,
            "STREAMS",
            streamKey,
            ">"
          )) as Array<[string, Array<[string, string[]]>]> | null;
        } else {
          raw = (await (this.client as any).xreadgroup(
            "GROUP",
            options.group,
            options.consumer,
            "COUNT",
            count,
            "STREAMS",
            streamKey,
            ">"
          )) as Array<[string, Array<[string, string[]]>]> | null;
        }

        if (!raw) return [];
        const [, entries] = raw[0];
        return RedisStreamsAdapter.parseEntries(entries);
      }
    );
  }

  /** Acknowledges a processed stream entry. */
  async xack(
    streamKey: string,
    group: string,
    ...ids: string[]
  ): Promise<void> {
    await withObservability(this.obs, "RedisStreamsAdapter.xack", async () => {
      await (this.client as any).xack(streamKey, group, ...ids);
    });
  }

  /**
   * Re-claims pending entries from a crashed consumer.
   * Returns entries that have been idle longer than minIdleMs.
   */
  async xautoclaim(
    streamKey: string,
    group: string,
    consumer: string,
    minIdleMs: number,
    count?: number
  ): Promise<StreamEntry[]> {
    return withObservability(
      this.obs,
      "RedisStreamsAdapter.xautoclaim",
      async () => {
        // XAUTOCLAIM available in Redis 7.0+. Falls back gracefully.
        try {
          const result = (await (this.client as any).xautoclaim(
            streamKey,
            group,
            consumer,
            minIdleMs,
            "0-0",
            "COUNT",
            count ?? this.streams.readBatchSize
          )) as [string, Array<[string, string[]]>];
          return RedisStreamsAdapter.parseEntries(result[1]);
        } catch (err: any) {
          // If XAUTOCLAIM not supported, return empty (graceful degradation)
          this.obs.logger.warn("XAUTOCLAIM not supported, skipping re-claim", {
            error: err?.message,
          });
          return [];
        }
      }
    );
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private static parseEntries(raw: Array<[string, string[]]>): StreamEntry[] {
    if (!Array.isArray(raw)) return [];
    return raw.map(([id, fieldArr]) => {
      const fields: Record<string, string> = {};
      for (let i = 0; i < fieldArr.length; i += 2) {
        fields[fieldArr[i]] = fieldArr[i + 1];
      }
      return { id, fields };
    });
  }
}
