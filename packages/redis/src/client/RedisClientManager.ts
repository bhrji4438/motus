import { Redis, Cluster } from "ioredis";
import type { MotusRedisConfig } from "@/config/index.js";
import { LuaScriptRegistry } from "@/scripts/LuaScriptRegistry.js";

export type RedisClient = Redis | Cluster;

/**
 * Manages the lifecycle of the ioredis client instance.
 *
 * Responsibilities:
 * - Constructs a standalone Redis, Sentinel, or Cluster client based on config.
 * - Registers all Lua scripts via LuaScriptRegistry.
 * - Configures retry strategy, offline queue, and command timeout.
 * - Emits connection lifecycle events.
 */
export class RedisClientManager {
  private _client: RedisClient | null = null;
  private _subscriberClient: Redis | null = null;

  constructor(private readonly config: MotusRedisConfig) {}

  /** Returns the primary Redis client, throwing if not yet connected. */
  get client(): RedisClient {
    if (!this._client) {
      throw new Error(
        "RedisClientManager: client not connected. Call connect() first."
      );
    }
    return this._client;
  }

  /**
   * Returns a dedicated subscriber connection (standalone mode only).
   * Subscriber connections cannot issue regular Redis commands.
   */
  get subscriberClient(): Redis {
    if (!this._subscriberClient) {
      throw new Error(
        "RedisClientManager: subscriber client not connected. Call connect() first."
      );
    }
    return this._subscriberClient;
  }

  /**
   * Creates and connects the ioredis client(s) based on the configured mode.
   * Registers all Lua scripts. Safe to call multiple times (idempotent).
   */
  async connect(): Promise<void> {
    if (this._client) return;

    const {
      connection,
      retry,
      cluster: clusterCfg,
      sentinel: sentinelCfg,
    } = this.config;

    const retryStrategy = (times: number): number =>
      Math.min(times * retry.reconnectBaseDelayMs, retry.reconnectMaxDelayMs);

    switch (connection.mode) {
      case "cluster": {
        if (!clusterCfg)
          throw new Error(
            "RedisClientManager: cluster config required for cluster mode."
          );
        this._client = new Cluster(clusterCfg.nodes, {
          redisOptions: {
            password: clusterCfg.password,
            tls: clusterCfg.tls as any,
            commandTimeout: clusterCfg.commandTimeoutMs,
            maxRetriesPerRequest: retry.maxRetriesPerRequest,
          },
          clusterRetryStrategy: retryStrategy,
          slotsRefreshInterval: clusterCfg.slotsRefreshIntervalMs,
          maxRedirections: clusterCfg.maxRedirections,
          enableOfflineQueue: connection.enableOfflineQueue,
        });
        // Cluster mode: use the same cluster for pub/sub (ioredis routes PUBLISH)
        break;
      }

      case "sentinel": {
        if (!sentinelCfg)
          throw new Error(
            "RedisClientManager: sentinel config required for sentinel mode."
          );
        const sentinelClient = new Redis({
          sentinels: sentinelCfg.sentinels,
          name: sentinelCfg.name,
          sentinelPassword: sentinelCfg.sentinelPassword,
          password: sentinelCfg.password,
          db: sentinelCfg.db ?? 0,
          retryStrategy,
          maxRetriesPerRequest: retry.maxRetriesPerRequest,
          connectTimeout: connection.connectTimeoutMs,
          commandTimeout: connection.commandTimeoutMs,
          enableOfflineQueue: connection.enableOfflineQueue,
          maxLoadingRetryTime: sentinelCfg.failoverDetectionTimeoutMs,
        });
        this._client = sentinelClient;
        this._subscriberClient = this.createStandaloneSubscriber();
        break;
      }

      default: {
        // standalone
        this._client = new Redis({
          host: connection.host ?? "localhost",
          port: connection.port ?? 6379,
          password: connection.password,
          db: connection.db ?? 0,
          tls: connection.tls as any,
          retryStrategy,
          maxRetriesPerRequest: retry.maxRetriesPerRequest,
          connectTimeout: connection.connectTimeoutMs,
          commandTimeout: connection.commandTimeoutMs,
          enableOfflineQueue: connection.enableOfflineQueue,
        });
        this._subscriberClient = this.createStandaloneSubscriber();
        break;
      }
    }

    LuaScriptRegistry.register(this._client);

    await this.waitForReady(this._client);
  }

  /** Gracefully disconnects all clients. */
  async disconnect(): Promise<void> {
    if (this._subscriberClient) {
      await this._subscriberClient.quit();
      this._subscriberClient = null;
    }
    if (this._client) {
      await this._client.quit();
      this._client = null;
    }
  }

  /** Returns true if the client is connected and ready. */
  isConnected(): boolean {
    return this._client !== null && this._client.status === "ready";
  }

  private createStandaloneSubscriber(): Redis {
    const { connection, retry } = this.config;
    const retryStrategy = (times: number): number =>
      Math.min(times * retry.reconnectBaseDelayMs, retry.reconnectMaxDelayMs);

    return new Redis({
      host: connection.host ?? "localhost",
      port: connection.port ?? 6379,
      password: connection.password,
      db: connection.db ?? 0,
      tls: connection.tls as any,
      retryStrategy,
      maxRetriesPerRequest: retry.maxRetriesPerRequest,
      connectTimeout: connection.connectTimeoutMs,
      commandTimeout: connection.commandTimeoutMs,
      enableOfflineQueue: connection.enableOfflineQueue,
    });
  }

  private waitForReady(client: RedisClient): Promise<void> {
    return new Promise((resolve, reject) => {
      if (client.status === "ready") {
        resolve();
        return;
      }
      client.once("ready", resolve);
      client.once("error", reject);
    });
  }
}
