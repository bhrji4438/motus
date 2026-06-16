import { Server as SocketIOServer } from 'socket.io';
import { TenantId, DriverNamespace, MotusEvent } from '@motus/types';
import { IAuthenticator, AuthContext } from '@/auth/IAuthenticator.js';
import { AuthenticationManager } from '@/auth/AuthenticationManager.js';
import { SocketIOTransportAdapter } from '@/transport/SocketIOTransportAdapter.js';
import { RoomManager } from '@/managers/RoomManager.js';
import { ConnectionRegistry } from '@/managers/ConnectionRegistry.js';
import { SubscriptionManager } from '@/managers/SubscriptionManager.js';
import { RecoveryManager } from '@/recovery/RecoveryManager.js';
import { RedisAdapterManager, RedisAdapterConfig } from '@/redis/RedisAdapterManager.js';
import { FailureRecoveryManager } from '@/recovery/FailureRecoveryManager.js';
import { MetricsManager, SocketObservabilityDeps } from '@/observability/MetricsManager.js';
import { EventRouter } from '@/routing/EventRouter.js';
import { DriverGateway } from '@/gateways/DriverGateway.js';
import { SessionGateway } from '@/gateways/SessionGateway.js';
import { TrackingGateway } from '@/gateways/TrackingGateway.js';

export interface SocketIOConfig {
  port?: number;
  path?: string;
  pingIntervalMs?: number;
  pingTimeoutMs?: number;
  maxPayloadSizeBytes?: number;
  connectionStateRecovery?: {
    enabled: boolean;
    maxConnectionDelayMs?: number;
  };
  limits?: {
    maxRoomsPerSocket?: number;
    maxSubscriptionsPerSocket?: number;
    maxConnectionsPerIp?: number;
  };
  auth?: {
    tokenExpiryGraceMs?: number;
    enableStrictTenantCheck?: boolean;
  };
  redis?: RedisAdapterConfig;
}

export class SocketServer {
  public readonly io: SocketIOServer;
  public readonly transport: SocketIOTransportAdapter;
  public readonly metricsManager: MetricsManager;

  // Managers
  public readonly authenticationManager: AuthenticationManager;
  public readonly roomManager: RoomManager;
  public readonly connectionRegistry: ConnectionRegistry;
  public readonly subscriptionManager: SubscriptionManager;
  public readonly recoveryManager: RecoveryManager;
  public readonly redisAdapterManager: RedisAdapterManager;
  public readonly failureRecoveryManager: FailureRecoveryManager;
  public readonly eventRouter: EventRouter;

  // Gateways
  public readonly driverGateway: DriverGateway;
  public readonly sessionGateway: SessionGateway;
  public readonly trackingGateway: TrackingGateway;

  // State
  private readonly subscribedTenants = new Set<TenantId>();

  constructor(
    config: SocketIOConfig,
    authenticator: IAuthenticator,
    driverNamespace: DriverNamespace,
    private readonly eventBus?: any, // EventDispatcher or RedisEventBus
    obsDeps?: SocketObservabilityDeps
  ) {
    this.metricsManager = new MetricsManager(obsDeps);

    // Initialize Socket.IO Server options
    const serverOptions: any = {
      path: config.path ?? '/socket.io',
      pingInterval: config.pingIntervalMs ?? 25000,
      pingTimeout: config.pingTimeoutMs ?? 20000,
      maxHttpBufferSize: config.maxPayloadSizeBytes ?? 1e6, // 1MB
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    };

    if (config.connectionStateRecovery?.enabled) {
      serverOptions.connectionStateRecovery = {
        maxConnectionDelay: config.connectionStateRecovery.maxConnectionDelayMs ?? 120000,
        skipMiddlewares: false,
      };
    }

    this.io = new SocketIOServer(serverOptions);

    // Build internal modules
    const maxSubs = config.limits?.maxSubscriptionsPerSocket ?? 50;

    this.authenticationManager = new AuthenticationManager(
      authenticator,
      this.metricsManager,
      config.auth?.enableStrictTenantCheck ?? true
    );

    this.roomManager = new RoomManager(this.metricsManager);
    this.connectionRegistry = new ConnectionRegistry(this.metricsManager);
    this.subscriptionManager = new SubscriptionManager(this.metricsManager);
    this.recoveryManager = new RecoveryManager(
      this.roomManager,
      this.subscriptionManager,
      this.connectionRegistry,
      this.metricsManager
    );

    this.failureRecoveryManager = new FailureRecoveryManager(driverNamespace, this.metricsManager);

    this.eventRouter = new EventRouter(
      driverNamespace,
      this.connectionRegistry,
      this.subscriptionManager,
      this.roomManager,
      this.metricsManager,
      maxSubs
    );

    this.transport = new SocketIOTransportAdapter(
      this.io,
      this.roomManager,
      this.metricsManager,
      config.port
    );

    // Build gateways
    this.driverGateway = new DriverGateway(this.transport, this.roomManager, this.eventRouter);
    this.sessionGateway = new SessionGateway(this.transport, this.roomManager, this.eventRouter);
    this.trackingGateway = new TrackingGateway(this.transport, this.roomManager, this.eventRouter);

    // Setup scaling
    this.redisAdapterManager = new RedisAdapterManager(
      config.redis ?? { enabled: false },
      this.metricsManager
    );

    // Initialize Middleware and Listeners
    this.setupAuthentication();
    this.setupConnectionHandling();
    this.redisAdapterManager.initialize(this.io);

    // Connect to external EventBus
    this.bridgeEventBus();
  }

  /**
   * Starts the transport listener.
   */
  public async start(): Promise<void> {
    await this.transport.start();
  }

  /**
   * Gracefully shuts down listeners and timers.
   */
  public async stop(): Promise<void> {
    this.failureRecoveryManager.cleanup();
    this.connectionRegistry.clear();
    this.subscriptionManager.clear();
    await this.transport.stop();
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  private setupAuthentication(): void {
    this.io.use(async (socket, next) => {
      try {
        const authContext = await this.authenticationManager.authenticateSocket(socket);
        socket.data.auth = authContext;
        next();
      } catch (err) {
        next(err as any);
      }
    });
  }

  private setupConnectionHandling(): void {
    this.io.on('connection', async (socket) => {
      const authContext = socket.data.auth as AuthContext;
      const socketId = socket.id;

      // 1. Connection registration
      this.connectionRegistry.register(socketId, authContext, socket);

      // 2. Auto-join tenant room
      const tenantRoom = this.roomManager.tenantRoom(authContext.tenantId);
      await this.roomManager.joinRoom(socket, tenantRoom, authContext.tenantId);

      // 3. Dynamic tenant event bus subscription
      this.subscribeTenantEvents(authContext.tenantId);

      // 4. If driver, join unicast room and clear offline timers
      if (authContext.driverId) {
        const driverRoom = this.roomManager.driverRoom(authContext.driverId);
        await this.roomManager.joinRoom(socket, driverRoom, authContext.tenantId);
        this.failureRecoveryManager.handleDriverReconnect(authContext.tenantId, authContext.driverId);

        // Bind driver events
        this.driverGateway.bindSocketEvents(socketId, socket);
      }

      // Bind generic session/tracking events
      this.sessionGateway.bindSocketEvents(socketId, socket);
      this.trackingGateway.bindSocketEvents(socketId, socket);

      // Handle custom disconnect cleanup
      socket.on('disconnect', (reason) => {
        this.metricsManager.logger.info(`Socket disconnected`, { socketId, reason });

        const entry = this.connectionRegistry.deregister(socketId);
        if (entry) {
          this.subscriptionManager.cleanup(socketId);

          if (entry.driverId) {
            // Check if driver has any other active devices connected
            const count = this.connectionRegistry.getDriverConnectionCount(entry.driverId);
            if (count === 0) {
              this.failureRecoveryManager.handleDriverDisconnect(entry.tenantId, entry.driverId, socketId);
            }
          }
        }
      });
    });
  }

  private subscribeTenantEvents(tenantId: TenantId): void {
    if (!this.eventBus || this.subscribedTenants.has(tenantId)) return;

    if (typeof this.eventBus.subscribeAll === 'function') {
      try {
        this.eventBus.subscribeAll(tenantId, (event: MotusEvent) => this.routeBusEvent(event));
        this.subscribedTenants.add(tenantId);
        this.metricsManager.logger.info(`Subscribed to event bus events for tenant: ${tenantId}`);
      } catch (err) {
        this.metricsManager.logger.error(`Failed to subscribe tenant to EventBus`, err);
      }
    }
  }

  private bridgeEventBus(): void {
    if (!this.eventBus) return;

    // Check if it exposes standard .on listener (like core EventDispatcher)
    if (typeof this.eventBus.on === 'function') {
      this.eventBus.on('*', (event: MotusEvent) => this.routeBusEvent(event));
      this.metricsManager.logger.info('Bridged local EventDispatcher to SocketServer');
    }
  }

  /**
   * Routes events received from core EventBus/RedisEventBus to WS rooms.
   */
  public routeBusEvent(event: MotusEvent): void {
    const { eventName, payload } = event;

    try {
      this.metricsManager.trackLatency(`bridge:${eventName}`, () => {
        // Dispatch to gateways based on schema matrix
        if (eventName === 'driver.location.updated' || eventName === 'telemetry.sampled') {
          const sessionId = (payload as any).sessionId;
          if (sessionId) {
            this.trackingGateway.broadcastTrackingUpdate(sessionId, {
              location: (payload as any).location,
              speed: (payload as any).speed,
              bearing: (payload as any).bearing,
              timestamp: event.timestamp,
            });
          }
        } else if (eventName === 'dispatch.wave.started') {
          const candidates = (payload as any).candidates as string[];
          const offerPayload = {
            sessionId: (payload as any).sessionId,
            waveNumber: (payload as any).waveNumber,
            expiresAt: (payload as any).expiresAt,
          };
          if (candidates) {
            for (const c of candidates) {
              this.driverGateway.sendAssignmentOffer(c, offerPayload);
            }
          }
        } else if (eventName.startsWith('session.')) {
          const sessionId = (payload as any).sessionId;
          if (sessionId) {
            // Trim 'session.' prefix for client event names
            const baseName = eventName.replace(/^session\./, '');
            this.sessionGateway.broadcastSessionEvent(sessionId, baseName, payload);
          }
        }
      });
    } catch (err) {
      this.metricsManager.logger.error(`Failed to bridge event to socket clients`, err);
    }
  }
}
