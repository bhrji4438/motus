import { TenantId, MatchingConfig, FanoutConfig, TelemetryConfig } from '@motus/types';
import { IConfigurationProvider } from '@/internal/interfaces/ports.js';
import {
  DEFAULT_MATCHING_CONFIG,
  DEFAULT_FANOUT_CONFIG,
  DEFAULT_TELEMETRY_CONFIG
} from '@/internal/config/DefaultConfiguration.js';
import { ConfigurationValidator } from '@/internal/config/ConfigurationValidator.js';

export class ConfigurationManager {
  private readonly validator = new ConfigurationValidator();

  constructor(private readonly configProvider: IConfigurationProvider) {}

  public async getMatchingConfig(tenantId: TenantId): Promise<MatchingConfig> {
    const defaultStrategy = (await this.configProvider.getTenantOverride(tenantId, 'matching.defaultStrategy')) || DEFAULT_MATCHING_CONFIG.defaultStrategy;
    const initialRadiusMeters = (await this.configProvider.getTenantOverride(tenantId, 'matching.initialRadiusMeters')) || DEFAULT_MATCHING_CONFIG.initialRadiusMeters;
    const maxRadiusMeters = (await this.configProvider.getTenantOverride(tenantId, 'matching.maxRadiusMeters')) || DEFAULT_MATCHING_CONFIG.maxRadiusMeters;

    const config: MatchingConfig = {
      defaultStrategy: defaultStrategy as any,
      initialRadiusMeters: Number(initialRadiusMeters),
      maxRadiusMeters: Number(maxRadiusMeters)
    };

    this.validator.validateMatching(config);
    return config;
  }

  public async getFanoutConfig(tenantId: TenantId): Promise<FanoutConfig> {
    const waveSize = (await this.configProvider.getTenantOverride(tenantId, 'fanout.waveSize')) || DEFAULT_FANOUT_CONFIG.waveSize;
    const waveTimeoutSeconds = (await this.configProvider.getTenantOverride(tenantId, 'fanout.waveTimeoutSeconds')) || DEFAULT_FANOUT_CONFIG.waveTimeoutSeconds;

    const config: FanoutConfig = {
      waveSize: Number(waveSize),
      waveTimeoutSeconds: Number(waveTimeoutSeconds)
    };

    this.validator.validateFanout(config);
    return config;
  }

  public async getTelemetryConfig(tenantId: TenantId): Promise<TelemetryConfig> {
    const sampleDistanceMeters = (await this.configProvider.getTenantOverride(tenantId, 'telemetry.sampleDistanceMeters')) || DEFAULT_TELEMETRY_CONFIG.sampleDistanceMeters;
    const sampleIntervalSeconds = (await this.configProvider.getTenantOverride(tenantId, 'telemetry.sampleIntervalSeconds')) || DEFAULT_TELEMETRY_CONFIG.sampleIntervalSeconds;
    const streamTtlSeconds = (await this.configProvider.getTenantOverride(tenantId, 'telemetry.streamTtlSeconds')) || DEFAULT_TELEMETRY_CONFIG.streamTtlSeconds;

    const config: TelemetryConfig = {
      sampleDistanceMeters: Number(sampleDistanceMeters),
      sampleIntervalSeconds: Number(sampleIntervalSeconds),
      streamTtlSeconds: Number(streamTtlSeconds)
    };

    this.validator.validateTelemetry(config);
    return config;
  }

  public async isFeatureEnabled(tenantId: TenantId, flag: string): Promise<boolean> {
    const value = await this.configProvider.getTenantOverride(tenantId, `features.${flag}`);
    return value === true || value === 'true';
  }
}
