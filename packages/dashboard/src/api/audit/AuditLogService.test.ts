import { describe, it, expect } from 'vitest';
import { AuditLogService } from '@/api/audit/AuditLogService.js';

describe('AuditLogService', () => {
  it('should log client actions and permit searching within tenant boundaries', async () => {
    const service = new AuditLogService();

    await service.logAction('T1', 'act-1', 'ADMIN', 'createSession', 'S100', 'Initialized session');
    await service.logAction('T1', 'act-2', 'DISPATCHER', 'updateLocation', 'driver-1', 'Updated driver location');
    await service.logAction('T2', 'act-1', 'ADMIN', 'createSession', 'S200', 'Tenant 2 session');

    const t1Logs = await service.searchLogs('T1');
    expect(t1Logs.length).toBe(2);

    const t2Logs = await service.searchLogs('T2');
    expect(t2Logs.length).toBe(1);
    expect(t2Logs[0].resource).toBe('S200');
  });

  it('should export audit trail to standard CSV format', async () => {
    const service = new AuditLogService();
    await service.logAction('T1', 'act-1', 'ADMIN', 'overrideMatching', 'S100', 'Overrode score matching');

    const csv = await service.exportCSV('T1');
    expect(csv).toContain('ID,ActorID,Role,Action,Resource,Details,Timestamp');
    expect(csv).toContain('"act-1"');
    expect(csv).toContain('"overrideMatching"');
    expect(csv).toContain('"Overrode score matching"');
  });
});
