import crypto from 'crypto';
import { AuditRecord } from '@/types/contracts.js';

export class AuditLogService {
  private logs: AuditRecord[] = [];

  /**
   * Log an operational action audit record.
   */
  public async logAction(
    tenantId: string,
    actorId: string,
    role: string,
    action: string,
    resource: string,
    details: string
  ): Promise<AuditRecord> {
    const record: AuditRecord = {
      id: `audit-${crypto.randomUUID()}`,
      tenantId,
      actorId,
      role,
      action,
      resource,
      details,
      timestamp: new Date().toISOString(),
    };
    this.logs.unshift(record); // Add to beginning of history
    return record;
  }

  /**
   * Retrieve audit logs filtered by tenant, action, or date ranges.
   */
  public async searchLogs(
    tenantId: string,
    filters: { action?: string; actorId?: string } = {}
  ): Promise<AuditRecord[]> {
    return this.logs.filter(log => {
      if (log.tenantId !== tenantId) return false;
      if (filters.action && log.action !== filters.action) return false;
      if (filters.actorId && log.actorId !== filters.actorId) return false;
      return true;
    });
  }

  /**
   * Export audit records in CSV format.
   */
  public async exportCSV(tenantId: string): Promise<string> {
    const tenantLogs = this.logs.filter(log => log.tenantId === tenantId);
    const headers = 'ID,ActorID,Role,Action,Resource,Details,Timestamp\n';
    const rows = tenantLogs
      .map(
        log =>
          `"${log.id}","${log.actorId}","${log.role}","${log.action}","${log.resource}","${log.details.replace(
            /"/g,
            '""'
          )}","${log.timestamp}"`
      )
      .join('\n');
    return headers + rows;
  }
}

// Global default audit logger instance
export const defaultAuditLog = new AuditLogService();
export default defaultAuditLog;
