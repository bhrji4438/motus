import { createAdapter } from "@socket.io/redis-adapter";
import { Redis } from "ioredis";
import { MetricsManager } from "@/observability/MetricsManager.js";

export interface RedisAdapterConfig {
  enabled: boolean;
  channelPrefix?: string;
  pubClient?: Redis;
  subClient?: Redis;
}

export class RedisAdapterManager {
  private isRedisConnected = false;
  private adapterInstance: any = null;

  constructor(
    private readonly config: RedisAdapterConfig,
    private readonly metrics: MetricsManager
  ) {}

  public initialize(ioServer: any): void {
    if (!this.config.enabled) {
      this.metrics.logger.info(
        "Redis scaling adapter is disabled. Operating in local mode."
      );
      return;
    }

    const { pubClient, subClient, channelPrefix = "motus" } = this.config;

    if (!pubClient || !subClient) {
      this.metrics.logger.warn(
        "Redis pubClient or subClient was not provided. Falling back to local mode."
      );
      return;
    }

    try {
      this.adapterInstance = createAdapter(pubClient, subClient, {
        key: channelPrefix,
      });
      ioServer.adapter(this.adapterInstance);
      this.isRedisConnected =
        pubClient.status === "ready" && subClient.status === "ready";

      this.registerConnectionListeners(pubClient, "pubClient");
      this.registerConnectionListeners(subClient, "subClient");

      this.metrics.logger.info(
        "Redis scaling adapter initialized successfully.",
        { channelPrefix }
      );
    } catch (err) {
      this.metrics.logger.error(
        "Failed to initialize Redis scaling adapter. Falling back to local mode.",
        err
      );
    }
  }

  public isAdapterHealthy(): boolean {
    return !this.config.enabled || this.isRedisConnected;
  }

  private registerConnectionListeners(client: Redis, name: string): void {
    client.on("connect", () => {
      this.metrics.logger.info(`Redis adapter client (${name}) connected.`);
    });

    client.on("ready", () => {
      this.metrics.logger.info(`Redis adapter client (${name}) is ready.`);
      this.evaluateHealth(client);
    });

    client.on("error", (err) => {
      this.metrics.logger.error(
        `Redis adapter client (${name}) encountered error:`,
        err
      );
      this.isRedisConnected = false;
      this.metrics.metrics.recordSocketError(
        undefined,
        "REDIS_CONNECTION_ERROR"
      );
    });

    client.on("close", () => {
      this.metrics.logger.warn(`Redis adapter client (${name}) closed.`);
      this.isRedisConnected = false;
    });
  }

  private evaluateHealth(client: Redis): void {
    // If the other client is also ready or if this is standalone/single-client state
    const otherClient =
      client === this.config.pubClient
        ? this.config.subClient
        : this.config.pubClient;
    if (
      client.status === "ready" &&
      (!otherClient || otherClient.status === "ready")
    ) {
      this.isRedisConnected = true;
      this.metrics.logger.info(
        "Redis scaling adapter health checks passed. Cluster sync active."
      );
    }
  }
}
