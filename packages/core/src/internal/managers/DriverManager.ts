import {
  Driver,
  DriverId,
  TenantId,
  RegisterDriverCommand,
  UpdateDriverCommand,
  DriverStatus,
} from "@motus/types";
import {
  IDriverRepository,
  IEventBus,
  IClock,
  IIdGenerator,
} from "@/internal/interfaces/ports.js";
import { DriverEntity } from "@/internal/entities/entities.js";
import { ErrorFactory } from "@/internal/errors/ErrorFactory.js";
import { StateMachineManager } from "@/internal/state/StateMachineManager.js";

export class DriverManager {
  private readonly stateMachine = new StateMachineManager();

  constructor(
    private readonly driverRepo: IDriverRepository,
    private readonly eventBus: IEventBus,
    private readonly clock: IClock,
    private readonly idGen: IIdGenerator
  ) {}

  public async registerDriver(command: RegisterDriverCommand): Promise<Driver> {
    const existing = await this.driverRepo.get(
      command.tenantId,
      command.driverId
    );
    if (existing) {
      return existing; // Idempotency
    }

    const driver = new DriverEntity(
      command.tenantId,
      command.driverId,
      DriverStatus.OFFLINE,
      { latitude: 0, longitude: 0, timestamp: this.clock.now().toISOString() },
      0,
      command.capacity || 1,
      this.clock.now().toISOString(),
      command.vehicleType
    );

    await this.driverRepo.save(driver);
    return driver;
  }

  public async updateDriver(command: UpdateDriverCommand): Promise<Driver> {
    const driver = await this.driverRepo.get(
      command.tenantId,
      command.driverId
    );
    if (!driver) {
      throw ErrorFactory.driverNotFound(command.driverId, command.tenantId);
    }

    const updatedDriver = new DriverEntity(
      driver.tenantId,
      driver.id,
      driver.status,
      driver.location,
      driver.currentLoad,
      command.capacity !== undefined ? command.capacity : driver.capacity,
      driver.lastHeartbeat,
      (driver as any).vehicleType
    );

    await this.driverRepo.save(updatedDriver);
    return updatedDriver;
  }

  public async getDriver(
    tenantId: TenantId,
    driverId: DriverId
  ): Promise<Driver> {
    const driver = await this.driverRepo.get(tenantId, driverId);
    if (!driver) {
      throw ErrorFactory.driverNotFound(driverId, tenantId);
    }
    return driver;
  }

  public async setDriverOnline(
    tenantId: TenantId,
    driverId: DriverId
  ): Promise<void> {
    const driver = await this.getDriver(tenantId, driverId);
    this.stateMachine.validateDriverTransition(
      driver.status,
      DriverStatus.ONLINE,
      {
        currentLoad: driver.currentLoad,
        capacity: driver.capacity,
      }
    );

    await this.driverRepo.setDriverStatus(
      tenantId,
      driverId,
      DriverStatus.ONLINE
    );

    this.eventBus.publish({
      eventId: this.idGen.generateEventId(),
      eventName: "driver.online",
      timestamp: this.clock.now().toISOString(),
      tenantId,
      payload: {
        tenantId,
        driverId,
        capacity: driver.capacity,
      },
      governance: {
        producer: "PresenceEngine",
        consumers: ["MatchingEngine", "SocketServer"],
        deliveryGuarantee: "AT_LEAST_ONCE",
        orderingScope: "DRIVER",
        partitionKey: "driverId",
        idempotencyRequirements:
          "Deduplicate by state transition timestamp to skip late-arriving offline states.",
        version: "1.0.0",
      },
    });
  }

  public async setDriverOffline(
    tenantId: TenantId,
    driverId: DriverId,
    reason: "MANUAL_DISCONNECT" | "HEARTBEAT_TIMEOUT" = "MANUAL_DISCONNECT"
  ): Promise<void> {
    const driver = await this.getDriver(tenantId, driverId);
    this.stateMachine.validateDriverTransition(
      driver.status,
      DriverStatus.OFFLINE,
      {
        currentLoad: driver.currentLoad,
        capacity: driver.capacity,
      }
    );

    await this.driverRepo.setDriverStatus(
      tenantId,
      driverId,
      DriverStatus.OFFLINE
    );

    this.eventBus.publish({
      eventId: this.idGen.generateEventId(),
      eventName: "driver.offline",
      timestamp: this.clock.now().toISOString(),
      tenantId,
      payload: {
        tenantId,
        driverId,
        reason,
      },
      governance: {
        producer: "PresenceEngine",
        consumers: ["DispatchEngine", "SocketServer"],
        deliveryGuarantee: "AT_LEAST_ONCE",
        orderingScope: "DRIVER",
        partitionKey: "driverId",
        idempotencyRequirements:
          "Process in sequence, cancel driver reservations upon receipt.",
        version: "1.0.0",
      },
    });
  }

  public async setDriverPaused(
    tenantId: TenantId,
    driverId: DriverId
  ): Promise<void> {
    const driver = await this.getDriver(tenantId, driverId);
    this.stateMachine.validateDriverTransition(
      driver.status,
      DriverStatus.PAUSED,
      {
        currentLoad: driver.currentLoad,
        capacity: driver.capacity,
      }
    );

    await this.driverRepo.setDriverStatus(
      tenantId,
      driverId,
      DriverStatus.PAUSED
    );

    this.eventBus.publish({
      eventId: this.idGen.generateEventId(),
      eventName: "driver.paused",
      timestamp: this.clock.now().toISOString(),
      tenantId,
      payload: {
        tenantId,
        driverId,
      },
      governance: {
        producer: "PresenceEngine",
        consumers: ["MatchingEngine"],
        deliveryGuarantee: "AT_LEAST_ONCE",
        orderingScope: "DRIVER",
        partitionKey: "driverId",
        idempotencyRequirements:
          "Process sequentially, pause dispatch updates.",
        version: "1.0.0",
      },
    });
  }

  public async setDriverStale(
    tenantId: TenantId,
    driverId: DriverId
  ): Promise<void> {
    const driver = await this.getDriver(tenantId, driverId);
    this.stateMachine.validateDriverTransition(
      driver.status,
      DriverStatus.STALE,
      {
        currentLoad: driver.currentLoad,
        capacity: driver.capacity,
      }
    );

    await this.driverRepo.setDriverStatus(
      tenantId,
      driverId,
      DriverStatus.STALE
    );
  }

  public async bindDriver(
    tenantId: TenantId,
    driverId: DriverId
  ): Promise<void> {
    const driver = await this.getDriver(tenantId, driverId);
    const newLoad = driver.currentLoad + 1;
    const newStatus =
      newLoad >= driver.capacity ? DriverStatus.BUSY : driver.status;

    const updated = new DriverEntity(
      driver.tenantId,
      driver.id,
      newStatus,
      driver.location,
      newLoad,
      driver.capacity,
      driver.lastHeartbeat,
      (driver as any).vehicleType
    );
    await this.driverRepo.save(updated);
  }

  public async unbindDriver(
    tenantId: TenantId,
    driverId: DriverId
  ): Promise<void> {
    const driver = await this.getDriver(tenantId, driverId);
    const newLoad = Math.max(0, driver.currentLoad - 1);
    const newStatus =
      driver.status === DriverStatus.BUSY && newLoad < driver.capacity
        ? DriverStatus.ONLINE
        : driver.status;

    const updated = new DriverEntity(
      driver.tenantId,
      driver.id,
      newStatus,
      driver.location,
      newLoad,
      driver.capacity,
      driver.lastHeartbeat,
      (driver as any).vehicleType
    );
    await this.driverRepo.save(updated);
  }
}
