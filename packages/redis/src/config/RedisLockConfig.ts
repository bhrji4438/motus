/**
 * Distributed lock behaviour, TTLs, and contention retry policy.
 */
export interface RedisLockConfig {
  /** Default TTL for session and driver locks in ms. @default 10000 */
  defaultLockTtlMs: number;
  /** TTL for presence stale-scan locks in ms. @default 30000 */
  presenceScanLockTtlMs: number;
  /** TTL for cleanup job locks in ms. @default 60000 */
  cleanupLockTtlMs: number;
  /** TTL for candidate reservation locks in ms. @default 30000 */
  candidateLockTtlMs: number;
  /** Maximum acquisition retry attempts on contention. @default 3 */
  retryMaxAttempts: number;
  /** Initial retry delay in ms. @default 50 */
  retryDelayMs: number;
  /** Exponential backoff multiplier applied each attempt. @default 2 */
  retryBackoffFactor: number;
  /** Random jitter range in ms added to each delay to prevent thundering herd. @default 25 */
  retryJitterMs: number;
  /**
   * Fraction of TTL at which a long-running holder should renew the lock.
   * 0.5 means renew when half the TTL has elapsed. @default 0.5
   */
  renewalThreshold: number;
}

/** Default lock config. */
export const DEFAULT_LOCK_CONFIG: RedisLockConfig = {
  defaultLockTtlMs: 10000,
  presenceScanLockTtlMs: 30000,
  cleanupLockTtlMs: 60000,
  candidateLockTtlMs: 30000,
  retryMaxAttempts: 3,
  retryDelayMs: 50,
  retryBackoffFactor: 2,
  retryJitterMs: 25,
  renewalThreshold: 0.5,
};
