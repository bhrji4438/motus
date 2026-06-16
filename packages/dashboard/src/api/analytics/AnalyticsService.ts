import { AnalyticsSummary } from "@/types/contracts.js";

export class AnalyticsService {
  private activeSessionsMap = new Map<string, number>(); // tenantId -> count

  /**
   * Aggregate active statistics for a given tenant context.
   */
  public async getTenantSummary(tenantId: string): Promise<AnalyticsSummary> {
    // Collect stats: in a real environment this would fetch from prom-client registry,
    // databases, and active tracking pools.
    const activeCount = this.activeSessionsMap.get(tenantId) || 0;

    return {
      tenantId,
      totalSessions: activeCount + 124, // Mock base statistics
      successRate: 0.965, // 96.5% success rate
      averageMatchingLatencySec: 3.42, // 3.42 seconds avg wave latency
      waveTimeoutsCount: 14,
      activeDriversCount: 42,
    };
  }

  public recordSessionStart(tenantId: string): void {
    const current = this.activeSessionsMap.get(tenantId) || 0;
    this.activeSessionsMap.set(tenantId, current + 1);
  }

  public recordSessionEnd(tenantId: string): void {
    const current = this.activeSessionsMap.get(tenantId) || 0;
    if (current > 0) {
      this.activeSessionsMap.set(tenantId, current - 1);
    }
  }
}

// Singleton instances
export const defaultAnalytics = new AnalyticsService();
export default defaultAnalytics;
