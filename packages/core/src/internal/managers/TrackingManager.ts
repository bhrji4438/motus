import {
  UpdateDriverLocationCommand
} from '@motus/types';
import { IDriverRepository, IEventBus, IClock, IIdGenerator } from '@/internal/interfaces/ports.js';
import { ErrorFactory } from '@/internal/errors/ErrorFactory.js';
import { DriverManager } from '@/internal/managers/DriverManager.js';

export class TrackingManager {
  // Store last processed location update details for backpressure throttling
  private readonly lastUpdates = new Map<string, { timestamp: number; latitude: number; longitude: number; speed: number }>();

  constructor(
    private readonly driverRepo: IDriverRepository,
    private readonly eventBus: IEventBus,
    private readonly clock: IClock,
    private readonly idGen: IIdGenerator,
    private readonly driverMgr: DriverManager
  ) {}

  public async updateDriverLocation(command: UpdateDriverLocationCommand): Promise<void> {
    // 1. Range Validation
    if (command.latitude < -90.0 || command.latitude > 90.0) {
      throw ErrorFactory.invalidArgument('latitude', `Latitude must be in range [-90.0, 90.0]. Provided: ${command.latitude}`);
    }
    if (command.longitude < -180.0 || command.longitude > 180.0) {
      throw ErrorFactory.invalidArgument('longitude', `Longitude must be in range [-180.0, 180.0]. Provided: ${command.longitude}`);
    }
    if (command.bearing !== undefined && (command.bearing < 0.0 || command.bearing > 360.0)) {
      throw ErrorFactory.invalidArgument('bearing', `Bearing must be in range [0.0, 360.0]. Provided: ${command.bearing}`);
    }
    if (command.speed !== undefined && (command.speed < 0.0 || command.speed > 100.0)) {
      throw ErrorFactory.invalidArgument('speed', `Speed must be in range [0.0, 100.0]. Provided: ${command.speed}`);
    }

    const serverNow = this.clock.now().getTime();
    const packetTime = new Date(command.timestamp).getTime();

    // Check future packet timestamp (allow 500ms max clock drift)
    if (packetTime > serverNow + 500) {
      throw ErrorFactory.invalidArgument('timestamp', `Timestamp is too far in the future. Packet: ${command.timestamp}, Server: ${this.clock.now().toISOString()}`);
    }

    const cacheKey = `${command.tenantId}:${command.driverId}`;
    const cached = this.lastUpdates.get(cacheKey);

    // Reject older/stale packets
    if (cached && packetTime < cached.timestamp) {
      return; // Discard out-of-order packets silently
    }

    // 2. Backpressure / Throttling Checks
    if (cached) {
      const elapsedMs = packetTime - cached.timestamp;

      // Time throttling: skip if < 1.0 second (1000ms) since last processed update
      if (elapsedMs < 1000) {
        return;
      }

      // Speed throttling: if driver is stationary (speed == 0), throttle to 5 seconds
      const isStationary = command.speed === 0 || (command.speed === undefined && cached.speed === 0);
      if (isStationary && elapsedMs < 5000) {
        return;
      }
    }

    // 3. Save Location to Repository
    await this.driverMgr.getDriver(command.tenantId, command.driverId);

    const updatedLocation = {
      latitude: command.latitude,
      longitude: command.longitude,
      timestamp: command.timestamp
    };

    await this.driverRepo.updateLocation(command.tenantId, command.driverId, updatedLocation);

    // Update local cache
    this.lastUpdates.set(cacheKey, {
      timestamp: packetTime,
      latitude: command.latitude,
      longitude: command.longitude,
      speed: command.speed || 0
    });

    // 4. Publish Location Update Event
    const payload: any = {
      tenantId: command.tenantId,
      driverId: command.driverId,
      location: { latitude: command.latitude, longitude: command.longitude }
    };
    if (command.speed !== undefined) {
      payload.speed = command.speed;
    }
    if (command.bearing !== undefined) {
      payload.bearing = command.bearing;
    }

    this.eventBus.publish({
      eventId: this.idGen.generateEventId(),
      eventName: 'driver.location.updated',
      timestamp: this.clock.now().toISOString(),
      tenantId: command.tenantId,
      payload,
      governance: {
        producer: 'LocationIngestion',
        consumers: ['GeofenceAuditor', 'SocketServer'],
        deliveryGuarantee: 'AT_MOST_ONCE',
        orderingScope: 'DRIVER',
        partitionKey: 'driverId',
        idempotencyRequirements: 'Discard out-of-order locations by checking update timestamp sequence.',
        version: '1.0.0'
      }
    });
  }
}
