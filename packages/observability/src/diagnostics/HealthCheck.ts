import os from 'os';

export type HealthStatus = 'UP' | 'DOWN' | 'DEGRADED';

export interface HealthCheckResult {
  status: HealthStatus;
  details?: Record<string, any>;
  timestamp: string;
}

export type HealthCheckFn = () => Promise<HealthCheckResult> | HealthCheckResult;

export class HealthCheckRegistry {
  private checks = new Map<string, HealthCheckFn>();

  /**
   * Register a dependency health check callback.
   */
  public register(name: string, check: HealthCheckFn): void {
    this.checks.set(name, check);
  }

  /**
   * Remove a registered check.
   */
  public unregister(name: string): void {
    this.checks.delete(name);
  }

  /**
   * Retrieve active performance statistics of the hosting OS/Node process.
   */
  public getSystemMetrics(): Record<string, any> {
    const mem = process.memoryUsage();
    return {
      uptimeSeconds: process.uptime(),
      cpuUsage: process.cpuUsage(),
      memory: {
        rss: mem.rss,
        heapTotal: mem.heapTotal,
        heapUsed: mem.heapUsed,
        external: mem.external,
      },
      system: {
        loadAvg: os.loadavg(),
        freeMemBytes: os.freemem(),
        totalMemBytes: os.totalmem(),
        cpuCoresCount: os.cpus().length,
      },
    };
  }

  /**
   * Run all registered checks and aggregate the status.
   */
  public async evaluate(): Promise<{
    status: HealthStatus;
    checks: Record<string, HealthCheckResult>;
    system: Record<string, any>;
    timestamp: string;
  }> {
    const results: Record<string, HealthCheckResult> = {};
    let aggregatedStatus: HealthStatus = 'UP';

    for (const [name, check] of this.checks.entries()) {
      try {
        const checkResult = await check();
        results[name] = checkResult;

        if (checkResult.status === 'DOWN') {
          aggregatedStatus = 'DOWN';
        } else if (checkResult.status === 'DEGRADED' && aggregatedStatus !== 'DOWN') {
          aggregatedStatus = 'DEGRADED';
        }
      } catch (error: any) {
        results[name] = {
          status: 'DOWN',
          details: { error: error.message || String(error) },
          timestamp: new Date().toISOString(),
        };
        aggregatedStatus = 'DOWN';
      }
    }

    return {
      status: aggregatedStatus,
      checks: results,
      system: this.getSystemMetrics(),
      timestamp: new Date().toISOString(),
    };
  }
}

// Global default health registry
export const defaultHealthRegistry = new HealthCheckRegistry();
export default defaultHealthRegistry;
