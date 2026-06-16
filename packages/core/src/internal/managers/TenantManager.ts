import {
  Tenant,
  TenantId,
  RegisterTenantCommand,
  UpdateTenantCommand,
} from "@motus/types";
import {
  ITenantRepository,
  IEventBus,
  IClock,
  IIdGenerator,
} from "@/internal/interfaces/ports.js";
import { TenantEntity } from "@/internal/entities/entities.js";
import { ErrorFactory } from "@/internal/errors/ErrorFactory.js";
import { ConfigurationValidator } from "@/internal/config/ConfigurationValidator.js";
import {
  DEFAULT_MATCHING_CONFIG,
  DEFAULT_FANOUT_CONFIG,
} from "@/internal/config/DefaultConfiguration.js";

export class TenantManager {
  private readonly validator = new ConfigurationValidator();

  constructor(
    private readonly tenantRepo: ITenantRepository,
    private readonly eventBus: IEventBus,
    private readonly clock: IClock,
    private readonly idGen: IIdGenerator
  ) {}

  public async registerTenant(command: RegisterTenantCommand): Promise<Tenant> {
    // Idempotency check: if tenant already exists, return it
    const existing = await this.tenantRepo.get(command.tenantId);
    if (existing) {
      return existing;
    }

    // Resolve matching configuration
    const matchingConfig = {
      strategy: command.matchingStrategy,
      maxSearchRadius: {
        value: DEFAULT_MATCHING_CONFIG.maxRadiusMeters,
        unit: "METERS" as const,
      },
      maxCandidatesPerWave:
        command.maxCapacityPerDriver ||
        DEFAULT_MATCHING_CONFIG.initialRadiusMeters, // using fallback
    };

    // Resolve fanout configuration
    const fanoutConfig = {
      mode: "PARALLEL" as const,
      intervalSeconds: 5,
    };

    // Resolve retry policy
    const retryPolicy = {
      maxWaves: 5,
      waveTimeoutSeconds:
        command.waveTimeoutSeconds || DEFAULT_FANOUT_CONFIG.waveTimeoutSeconds,
      reEvaluationDelaySeconds: 10,
    };

    // Convert geofences from command to zones
    const zones = (command.geofences || []).map((gf, idx) => ({
      zoneId: `zone_${idx}_${this.idGen.generateEventId()}`,
      name: gf.name,
      boundary: gf.boundary,
    }));

    const tenant = new TenantEntity(
      command.tenantId,
      command.name,
      matchingConfig,
      fanoutConfig,
      retryPolicy,
      zones
    );

    // Validate config constraints
    this.validator.validateMatching({
      defaultStrategy: command.matchingStrategy.toLowerCase() as any,
      initialRadiusMeters: DEFAULT_MATCHING_CONFIG.initialRadiusMeters,
      maxRadiusMeters: DEFAULT_MATCHING_CONFIG.maxRadiusMeters,
    });
    this.validator.validateFanout({
      waveSize: DEFAULT_FANOUT_CONFIG.waveSize,
      waveTimeoutSeconds: retryPolicy.waveTimeoutSeconds,
    });

    await this.tenantRepo.save(tenant);

    // Publish event
    this.eventBus.publish({
      eventId: this.idGen.generateEventId(),
      eventName: "tenant.created",
      timestamp: this.clock.now().toISOString(),
      tenantId: tenant.id,
      payload: {
        tenantId: tenant.id,
        name: tenant.name,
      },
      governance: {
        producer: "TenantService",
        consumers: ["BillingEngine", "SocketServer"],
        deliveryGuarantee: "AT_LEAST_ONCE",
        orderingScope: "TENANT",
        partitionKey: "tenantId",
        idempotencyRequirements:
          "Deduplicate by event ID to prevent duplicate database creation operations.",
        version: "1.0.0",
      },
    });

    return tenant;
  }

  public async updateTenant(command: UpdateTenantCommand): Promise<Tenant> {
    const tenant = await this.tenantRepo.get(command.tenantId);
    if (!tenant) {
      throw ErrorFactory.invalidArgument(
        "tenantId",
        `Tenant with ID ${command.tenantId} not found.`
      );
    }

    const updatedMatchingConfig = {
      ...tenant.matchingConfig,
      strategy: command.matchingStrategy || tenant.matchingConfig.strategy,
    };

    const updatedRetryPolicy = {
      ...tenant.retryPolicy,
      waveTimeoutSeconds:
        command.waveTimeoutSeconds || tenant.retryPolicy.waveTimeoutSeconds,
    };

    const updatedZones = command.geofences
      ? command.geofences.map((gf, idx) => ({
          zoneId: `zone_${idx}_${this.idGen.generateEventId()}`,
          name: gf.name,
          boundary: gf.boundary,
        }))
      : tenant.zones;

    const updatedTenant = new TenantEntity(
      tenant.id,
      command.name || tenant.name,
      updatedMatchingConfig,
      tenant.fanoutConfig,
      updatedRetryPolicy,
      updatedZones
    );

    await this.tenantRepo.save(updatedTenant);
    return updatedTenant;
  }

  public async getTenant(tenantId: TenantId): Promise<Tenant> {
    const tenant = await this.tenantRepo.get(tenantId);
    if (!tenant) {
      throw ErrorFactory.invalidArgument(
        "tenantId",
        `Tenant with ID ${tenantId} not found.`
      );
    }
    return tenant;
  }
}
