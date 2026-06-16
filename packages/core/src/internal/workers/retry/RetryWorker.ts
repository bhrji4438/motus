import { TenantId, SessionId, SessionState } from '@motus/types';
import { ISessionRepository, ILockManager } from '@/internal/interfaces/ports.js';
import { FanoutEngine } from '@/internal/services/fanout/FanoutEngine.js';
import { SessionManager } from '@/internal/managers/SessionManager.js';

export class RetryWorker {
  constructor(
    _sessionMgr: SessionManager,
    private readonly sessionRepo: ISessionRepository,
    private readonly lockMgr: ILockManager,
    private readonly fanoutEngine: FanoutEngine
  ) {}

  /**
   * Evaluates if a session is still searching and triggers the next matching wave.
   * Typically executed after the cooling period (10s) expires.
   */
  public async evaluateRetry(tenantId: TenantId, sessionId: SessionId): Promise<void> {
    const lockKey = `lock:session:${sessionId}`;
    const acquired = await this.lockMgr.acquireLock(lockKey, 10);
    if (!acquired) {
      return; // Skip if session is locked
    }

    try {
      const session = await this.sessionRepo.get(tenantId, sessionId);
      if (!session || session.status !== SessionState.SEARCHING) {
        return; // Idempotency check: stop retry if state transitioned
      }

      await this.fanoutEngine.startNextWave(session);
    } finally {
      await this.lockMgr.releaseLock(lockKey);
    }
  }
}
