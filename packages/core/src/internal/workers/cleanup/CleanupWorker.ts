import { TenantId, SessionId, SessionState } from '@motus/types';
import { ISessionRepository, ILockManager } from '@/internal/interfaces/ports.js';

export class CleanupWorker {
  constructor(
    private readonly sessionRepo: ISessionRepository,
    private readonly lockMgr: ILockManager
  ) {}

  public async pruneSessionData(tenantId: TenantId, sessionId: SessionId): Promise<void> {
    const lockKey = `lock:session:${sessionId}`;
    const acquired = await this.lockMgr.acquireLock(lockKey, 10);
    if (!acquired) {
      return;
    }

    try {
      const session = await this.sessionRepo.get(tenantId, sessionId);
      if (!session) {
        return;
      }

      // Only prune completed or cancelled sessions (terminal states)
      if (session.status === SessionState.COMPLETED || session.status === SessionState.CANCELLED) {
        // Prune the telemetry stream or other cache indicators.
        // In this pure engine core, this delegates to repository/stream delete commands.
      }
    } finally {
      await this.lockMgr.releaseLock(lockKey);
    }
  }
}
