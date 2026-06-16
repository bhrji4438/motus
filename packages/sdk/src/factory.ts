import { randomUUID } from "node:crypto";
import {
  Motus,
  TenantNamespace,
  DriverNamespace,
  SessionNamespace,
  QueryNamespace,
  EventNamespace,
  TenantManager,
  DriverManager,
  SessionManager,
  ConfigurationManager,
  EventDispatcher,
  TrackingManager,
  AssignmentManager,
  FanoutEngine,
  MatchingEngine,
  DriverStaleDetector,
  DriverLostMonitor,
  RetryWorker,
  FanoutTimeoutWorker,
  CleanupWorker,
  IClock,
  IIdGenerator,
  IConfigurationProvider,
  IMetricsCollector,
  ILogger,
} from "@motus/core";

import {
  RedisClientManager,
  RedisTenantRepository,
  RedisDriverRepository,
  RedisSessionRepository,
  RedisLockManager,
  RedisCleanupService,
  RedisEventBus,
  DEFAULT_MOTUS_REDIS_CONFIG,
  KeyFactory,
} from "@motus/redis";

import {
  SocketServer,
  IAuthenticator,
  AuthContext,
} from "@motus/socketio";

import { logger } from "@motus/observability";

import { VectroConfig } from "./config.js";

import type {
  MotusEvent,
} from "@motus/types";

/**
 * Concrete system clock implementation.
 */
class SystemClock implements IClock {
  public now(): Date {
    return new Date();
  }
}

/**
 * Concrete system ID generator using cryptographically secure random UUIDs.
 */
class SystemIdGenerator implements IIdGenerator {
  public generateTenantId(): string {
    return `tnt_${randomUUID()}`;
  }
  public generateDriverId(): string {
    return `drv_${randomUUID()}`;
  }
  public generateSessionId(): string {
    return `ses_${randomUUID()}`;
  }
  public generateEventId(): string {
    return randomUUID();
  }
}

/**
 * Permissive developer authenticator for quick onboarding.
 */
class SimpleAuthenticator implements IAuthenticator {
  public async authenticate(handshakeData: {
    token?: string;
    auth?: Record<string, any>;
    query?: Record<string, any>;
  }): Promise<AuthContext> {
    const tenantId =
      handshakeData.auth?.tenantId ||
      handshakeData.query?.tenantId ||
      "default-tenant";
    const driverId =
      handshakeData.auth?.driverId ||
      handshakeData.query?.driverId;
    return {
      tenantId,
      driverId,
    };
  }
}

/**
 * Bridged event bus that acts as a publisher and forwards events to both
 * Redis Pub/Sub and a local EventDispatcher.
 */
class BridgedEventBus extends EventDispatcher {
  private seenIds = new Set<string>();
  private idQueue: string[] = [];

  constructor(
    public readonly redisBus: RedisEventBus
  ) {
    super();
  }

  public override async publish(event: MotusEvent): Promise<void> {
    // 1. Publish to Redis Event Bus (writes to stream + publishes to pub/sub)
    await this.redisBus.publish(event);

    // 2. Publish locally (avoiding duplicates)
    await this.publishLocally(event);
  }

  public async publishLocally(event: MotusEvent): Promise<void> {
    if (this.seenIds.has(event.eventId)) {
      return;
    }
    this.seenIds.add(event.eventId);
    this.idQueue.push(event.eventId);
    if (this.idQueue.length > 1000) {
      const oldest = this.idQueue.shift();
      if (oldest) this.seenIds.delete(oldest);
    }
    await super.publish(event);
  }
}

/**
 * Default configuration provider for ConfigurationManager.
 */
class DefaultConfigurationProvider implements IConfigurationProvider {
  public async getTenantOverride(
    _tenantId: string,
    _key: string
  ): Promise<any> {
    return undefined;
  }
}

/**
 * Returned instance of a configured Vectro engine platform.
 */
export interface VectroInstance {
  readonly tenant: TenantNamespace;
  readonly driver: DriverNamespace;
  readonly session: SessionNamespace;
  readonly query: QueryNamespace;
  readonly events: EventNamespace;

  /**
   * Gracefully shuts down the background workers, connections, and Socket.IO server.
   */
  stop(): Promise<void>;
}

/**
 * Factory function to create and fully initialize the Vectro platform.
 * Boots up Redis connections, background workers, event handlers, and Socket.IO server.
 */
export async function createVectro(
  config?: VectroConfig
): Promise<VectroInstance> {
  const clock = new SystemClock();
  const idGen = new SystemIdGenerator();

  const metrics: IMetricsCollector = {
    recordMatchingLatency() {},
    recordFanoutDuration() {},
    incrementAssignmentSuccess() {},
    incrementAssignmentTimeout() {},
    incrementStaleDetection() {},
    incrementDriverLost() {},
  };

  // 1. Resolve configuration from parameters and environment variables
  const host =
    config?.redis?.host ?? process.env.REDIS_HOST ?? "localhost";
  const port =
    config?.redis?.port ??
    (process.env.REDIS_PORT
      ? parseInt(process.env.REDIS_PORT, 10)
      : 6379);
  const password =
    config?.redis?.password ?? process.env.REDIS_PASSWORD;
  const db =
    config?.redis?.db ??
    (process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : 0);
  const mode = config?.redis?.mode ?? "standalone";

  const connectionConfig: any = {
    ...DEFAULT_MOTUS_REDIS_CONFIG.connection,
    mode,
    host,
    port,
    db,
  };
  if (password !== undefined) {
    connectionConfig.password = password;
  }

  const keyPrefix = config?.redis?.keyPrefix ?? "vectro";
  KeyFactory.prefix = keyPrefix;

  const redisConfig = {
    ...DEFAULT_MOTUS_REDIS_CONFIG,
    connection: connectionConfig,
    pubsub: {
      ...DEFAULT_MOTUS_REDIS_CONFIG.pubsub,
      channelPrefix: keyPrefix,
    },
  };

  // 2. Initialize Redis Client Manager and Connect
  const redisClientManager = new RedisClientManager(redisConfig);
  await redisClientManager.connect();
  const redisClient = redisClientManager.client;

  // 3. Initialize Redis Repositories
  const tenantRepo = new RedisTenantRepository(redisClient);
  const driverRepo = new RedisDriverRepository(redisClient);
  const sessionRepo = new RedisSessionRepository(
    redisClient,
    redisConfig.retention
  );
  const lockMgr = new RedisLockManager(redisClient, redisConfig.lock);

  // 4. Initialize Redis Event Bus and Bridged Event Bus
  const redisEventBus = new RedisEventBus(
    redisClientManager,
    redisConfig.pubsub,
    redisConfig.streams
  );
  const bridgedEventBus = new BridgedEventBus(
    redisEventBus
  );

  // Forward incoming pub/sub events from Redis back to local dispatcher
  // So that local listeners configured on events namespace are triggered
  await redisEventBus.subscribeAll("*", (event: MotusEvent) => {
    bridgedEventBus.publishLocally(event).catch(() => {});
  });

  // 5. Initialize Managers and Engines
  const configProvider = new DefaultConfigurationProvider();
  const configMgr = new ConfigurationManager(configProvider);

  const tenantMgr = new TenantManager(
    tenantRepo,
    bridgedEventBus,
    clock,
    idGen
  );

  const driverMgr = new DriverManager(
    driverRepo,
    bridgedEventBus,
    clock,
    idGen
  );

  const sessionMgr = new SessionManager(
    sessionRepo,
    lockMgr,
    bridgedEventBus,
    clock,
    idGen,
    driverMgr
  );

  const matchingEngine = new MatchingEngine(
    tenantRepo,
    driverRepo,
    clock,
    logger,
    metrics
  );

  const fanoutEngine = new FanoutEngine(
    sessionMgr,
    matchingEngine,
    configMgr,
    lockMgr,
    bridgedEventBus,
    clock,
    idGen,
    metrics
  );

  const trackingMgr = new TrackingManager(
    driverRepo,
    bridgedEventBus,
    clock,
    idGen,
    driverMgr
  );

  const assignmentMgr = new AssignmentManager(
    sessionRepo,
    lockMgr,
    bridgedEventBus,
    clock,
    idGen,
    driverMgr,
    fanoutEngine,
    metrics
  );

  // 6. Initialize Background Workers
  const driverStaleDetector = new DriverStaleDetector(
    driverMgr,
    driverRepo,
    lockMgr,
    clock,
    metrics
  );

  const fanoutTimeoutWorker = new FanoutTimeoutWorker(
    sessionMgr,
    sessionRepo,
    lockMgr,
    fanoutEngine,
    clock,
    idGen,
    metrics
  );

  const retryWorker = new RetryWorker(
    sessionMgr,
    sessionRepo,
    lockMgr,
    fanoutEngine
  );

  const driverLostMonitor = new DriverLostMonitor(
    sessionMgr,
    sessionRepo,
    lockMgr,
    bridgedEventBus,
    clock,
    idGen,
    metrics
  );

  // 7. Initialize and Start Core Facade
  const motus = new Motus(
    tenantMgr,
    driverMgr,
    sessionMgr,
    clock,
    bridgedEventBus
  );

  // Wire up namespace dependency resolution (crucial pre-existing tech debt)
  motus.driver.setDependencies(trackingMgr, assignmentMgr);

  // 8. Discover Active Tenants and Sessions
  const activeTenantIds = new Set<string>();
  const activeSessionIds = new Set<string>();

  const scanActiveTenants = async () => {
    try {
      let cursor = "0";
      do {
        const [nextCursor, keys] = (await (redisClient as any).scan(
          cursor,
          "MATCH",
          "tenant:*:config",
          "COUNT",
          100
        )) as [string, string[]];
        cursor = nextCursor;
        for (const key of keys) {
          const match = key.match(/^tenant:\{([^}]+)\}:config$/);
          if (match) {
            activeTenantIds.add(match[1]);
          }
        }
      } while (cursor !== "0");
    } catch (err) {
      logger.error("Failed to scan active tenants during boot", err);
    }
  };

  const scanActiveSessions = async () => {
    try {
      let cursor = "0";
      do {
        const [nextCursor, keys] = (await (redisClient as any).scan(
          cursor,
          "MATCH",
          "tenant:*:session:*",
          "COUNT",
          100
        )) as [string, string[]];
        cursor = nextCursor;
        for (const key of keys) {
          const match = key.match(/^tenant:\{([^}]+)\}:session:([^:]+)$/);
          if (match) {
            const tenantId = match[1];
            const sessionId = match[2];
            try {
              const session = await sessionRepo.get(tenantId, sessionId);
              if (
                session &&
                (session.status === "SEARCHING" ||
                  session.status === "DRIVER_LOST" ||
                  session.status === "DRIVER_ASSIGNED")
              ) {
                activeSessionIds.add(`${tenantId}:${sessionId}`);
              }
            } catch {
              // ignore
            }
          }
        }
      } while (cursor !== "0");
    } catch (err) {
      logger.error("Failed to scan active sessions during boot", err);
    }
  };

  await scanActiveTenants();
  await scanActiveSessions();

  // 9. Start Redis Cleanup Service
  const cleanupService = new RedisCleanupService(
    redisClient,
    redisConfig.cleanup,
    redisConfig.retention,
    redisConfig.lock
  );
  cleanupService.start();
  for (const tenantId of activeTenantIds) {
    cleanupService.startPresenceCleanup(tenantId);
  }

  // 10. Bind Event Listeners for Dynamic Tracking
  bridgedEventBus.on("tenant.created", (event: MotusEvent) => {
    const tenantId = event.tenantId;
    activeTenantIds.add(tenantId);
    cleanupService.startPresenceCleanup(tenantId);
  });

  bridgedEventBus.on("session.created", (event: MotusEvent) => {
    const sessionId = (event.payload as any).sessionId;
    activeSessionIds.add(`${event.tenantId}:${sessionId}`);
  });

  bridgedEventBus.on("session.searching", (event: MotusEvent) => {
    const sessionId = (event.payload as any).sessionId;
    activeSessionIds.add(`${event.tenantId}:${sessionId}`);
  });

  bridgedEventBus.on("session.driver_lost", (event: MotusEvent) => {
    const sessionId = (event.payload as any).sessionId;
    activeSessionIds.add(`${event.tenantId}:${sessionId}`);
  });

  bridgedEventBus.on("session.assigned", (event: MotusEvent) => {
    const sessionId = (event.payload as any).sessionId;
    activeSessionIds.add(`${event.tenantId}:${sessionId}`);
  });

  bridgedEventBus.on("session.completed", (event: MotusEvent) => {
    const sessionId = (event.payload as any).sessionId;
    activeSessionIds.delete(`${event.tenantId}:${sessionId}`);
  });

  bridgedEventBus.on("session.cancelled", (event: MotusEvent) => {
    const sessionId = (event.payload as any).sessionId;
    activeSessionIds.delete(`${event.tenantId}:${sessionId}`);
  });

  // Start the first wave on SEARCHING session
  bridgedEventBus.on("session.searching", async (event: MotusEvent) => {
    const sessionId = (event.payload as any).sessionId;
    const tenantId = event.tenantId;
    try {
      const session = await sessionRepo.get(tenantId, sessionId);
      if (session && session.waves.length === 0) {
        await fanoutEngine.startNextWave(session);
      }
    } catch (err) {
      logger.error(`Failed to automatically start first wave for session ${sessionId}`, err);
    }
  });

  // 11. Run Periodic Intervals for Background Workers
  const intervals: NodeJS.Timeout[] = [];

  // Driver presence stale scan (every 10s)
  const staleInterval = setInterval(async () => {
    for (const tenantId of activeTenantIds) {
      try {
        await driverStaleDetector.scanStaleDrivers(tenantId);
      } catch (err) {
        logger.error(`DriverStaleDetector failed for tenant ${tenantId}`, err);
      }
    }
  }, 10000);
  intervals.push(staleInterval);

  // Session wave expiration and retrying (every 2s)
  const sessionInterval = setInterval(async () => {
    for (const key of activeSessionIds) {
      const [tenantId, sessionId] = key.split(":");
      try {
        await fanoutTimeoutWorker.checkWaveExpirations(tenantId, sessionId);
        await driverLostMonitor.handleRecoveryTimeout(tenantId, sessionId);

        const session = await sessionRepo.get(tenantId, sessionId);
        if (session && session.status === "SEARCHING") {
          const activeWave = session.waves[session.waves.length - 1];
          if (!activeWave || activeWave.status !== "ACTIVE") {
            await retryWorker.evaluateRetry(tenantId, sessionId);
          }
        }
      } catch (err) {
        logger.error(`Session background processing failed for ${sessionId}`, err);
      }
    }
  }, 2000);
  intervals.push(sessionInterval);

  // 12. Socket.IO Realtime Server Initialization and Boot
  let socketServer: SocketServer | undefined;
  if (config?.socketio?.port !== undefined) {
    const authenticator =
      config.socketio.authenticator ?? new SimpleAuthenticator();

    const socketConfig: any = {
      port: config.socketio.port,
    };
    if (config.socketio.path !== undefined) {
      socketConfig.path = config.socketio.path;
    }
    if (config.socketio.connectionStateRecovery !== undefined) {
      socketConfig.connectionStateRecovery = config.socketio.connectionStateRecovery;
    }

    socketServer = new SocketServer(
      socketConfig,
      authenticator,
      motus.driver,
      bridgedEventBus
    );
    await socketServer.start();
  }

  // 13. Assemble and Return Vectro Instance Facade
  return {
    tenant: motus.tenant,
    driver: motus.driver,
    session: motus.session,
    query: motus.query,
    events: motus.events,

    async stop(): Promise<void> {
      // 1. Clear background worker loops
      for (const intervalId of intervals) {
        clearInterval(intervalId);
      }
      intervals.length = 0;

      // 2. Stop cleanup service
      cleanupService.stop();

      // 3. Stop Socket.IO server if started
      if (socketServer) {
        await socketServer.stop();
      }

      // 4. Disconnect Redis client
      await redisClientManager.disconnect();
    },
  };
}
export {
  DriverStaleDetector,
  DriverLostMonitor,
  RetryWorker,
  FanoutTimeoutWorker,
  CleanupWorker,
  IClock,
  IIdGenerator,
  IConfigurationProvider,
  IMetricsCollector,
  ILogger,
};
