import {
  TenantNamespace as ITenantNamespace,
  RegisterTenantCommand,
  UpdateTenantCommand,
  TenantResult,
  TenantId
} from '@motus/types';
import { TenantManager } from '@/internal/managers/TenantManager.js';

export class TenantNamespace implements ITenantNamespace {
  constructor(private readonly tenantMgr: TenantManager) {}

  public async registerTenant(command: RegisterTenantCommand): Promise<TenantResult> {
    const tenant = await this.tenantMgr.registerTenant(command);
    return this.mapTenantToResult(tenant);
  }

  public async updateTenant(command: UpdateTenantCommand): Promise<TenantResult> {
    const tenant = await this.tenantMgr.updateTenant(command);
    return this.mapTenantToResult(tenant);
  }

  public async getTenant(tenantId: TenantId): Promise<TenantResult> {
    const tenant = await this.tenantMgr.getTenant(tenantId);
    return this.mapTenantToResult(tenant);
  }

  private mapTenantToResult(tenant: any): TenantResult {
    return {
      id: tenant.id,
      tenantId: tenant.id,
      name: tenant.name,
      matchingStrategy: tenant.matchingConfig.strategy,
      waveTimeoutSeconds: tenant.retryPolicy.waveTimeoutSeconds,
      maxCapacityPerDriver: tenant.matchingConfig.maxCandidatesPerWave,
      geofences: (tenant.zones || []).map((z: any) => ({
        name: z.name,
        boundary: z.boundary
      }))
    };
  }
}
