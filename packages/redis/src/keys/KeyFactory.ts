import type { TenantId, DriverId, SessionId } from "@motus/types";

/**
 * Centralized key factory for all Redis key construction.
 *
 * Rules enforced:
 * - Every tenant-scoped key uses `{tenantId}` as the Redis Cluster hashtag,
 *   ensuring all keys for a tenant land on the same hash slot.
 * - No code outside this class constructs raw Redis key strings.
 * - Global keys (locks, expiry ZSET) are single-key operations only and
 *   are never combined with tenant-scoped keys in Lua scripts.
 */
export class KeyFactory {
  static prefix = "vectro";

  // ─── Tenant ────────────────────────────────────────────────────────────────

  /** Hash storing tenant configuration and zones. Slot: tenantId. */
  static tenantHash(tenantId: TenantId): string {
    return `tenant:{${tenantId}}:config`;
  }

  // ─── Driver ────────────────────────────────────────────────────────────────

  /** Hash storing full driver profile. Slot: tenantId. */
  static driverHash(tenantId: TenantId, driverId: DriverId): string {
    return `tenant:{${tenantId}}:driver:${driverId}`;
  }

  /** Geo sorted set storing lat/lon entries for all tenant drivers. Slot: tenantId. */
  static driverGeoIndex(tenantId: TenantId): string {
    return `tenant:{${tenantId}}:drivers:geo`;
  }

  /** Sorted set of active driver IDs scored by last heartbeat Unix ms. Slot: tenantId. */
  static driverPresenceZset(tenantId: TenantId): string {
    return `tenant:{${tenantId}}:presence:active`;
  }

  // ─── Session ───────────────────────────────────────────────────────────────

  /** Hash storing session metadata and waves. Slot: tenantId. */
  static sessionHash(tenantId: TenantId, sessionId: SessionId): string {
    return `tenant:{${tenantId}}:session:${sessionId}`;
  }

  /** Redis Stream storing telemetry points for an active session. Slot: tenantId. */
  static sessionTelemetryStream(
    tenantId: TenantId,
    sessionId: SessionId
  ): string {
    return `tenant:{${tenantId}}:session:${sessionId}:telemetry`;
  }

  /** Redis Stream storing domain events for a session. Slot: tenantId. */
  static sessionEventStream(tenantId: TenantId, sessionId: SessionId): string {
    return `tenant:{${tenantId}}:session:${sessionId}:events`;
  }

  // ─── Expiry ────────────────────────────────────────────────────────────────

  /**
   * Global sorted set tracking terminal session expiry times.
   * Members: `{tenantId}:{sessionId}`, Score: Unix timestamp of expiry.
   * Single-key command only — never combined with tenant-scoped keys in Lua.
   */
  static sessionExpiryZset(): string {
    return `${KeyFactory.prefix}:sessions:expiry`;
  }

  // ─── Locks ─────────────────────────────────────────────────────────────────

  /** Generic distributed lock key. Single-key command only. */
  static lock(resourceId: string): string {
    return `lock:${resourceId}`;
  }

  /** Session state-transition lock. Single-key command only. */
  static sessionLock(sessionId: SessionId): string {
    return `lock:session:${sessionId}`;
  }

  /** Driver capacity-binding lock. Single-key command only. */
  static driverLock(driverId: DriverId): string {
    return `lock:driver:${driverId}`;
  }

  /** Presence stale-scan lock ensuring single-node execution. Single-key command only. */
  static presenceScanLock(tenantId: TenantId): string {
    return `lock:presence:stale_scan:${tenantId}`;
  }

  /** Candidate reservation lock for a wave offer. Single-key command only. */
  static candidateLock(driverId: DriverId, sessionId: SessionId): string {
    return `lock:candidate:${driverId}:session:${sessionId}`;
  }

  /** Cleanup job lock for session expiry pruner. Single-key command only. */
  static cleanupSessionExpiryLock(): string {
    return "lock:cleanup:session_expiry";
  }

  /** Cleanup job lock for telemetry retention worker. Single-key command only. */
  static cleanupTelemetryLock(): string {
    return "lock:cleanup:telemetry_retention";
  }

  /** Cleanup job lock for event retention worker. Single-key command only. */
  static cleanupEventLock(): string {
    return "lock:cleanup:event_retention";
  }

  /** Cleanup job lock for presence stale worker. Single-key command only. */
  static cleanupPresenceLock(tenantId: TenantId): string {
    return `lock:cleanup:stale_presence:${tenantId}`;
  }

  // ─── Pub/Sub ───────────────────────────────────────────────────────────────

  /**
   * Pub/Sub channel for a specific event within a tenant.
   * Pattern: `motus:{tenantId}:events:{eventName}`
   */
  static pubSubChannel(
    channelPrefix: string,
    tenantId: TenantId,
    eventName: string
  ): string {
    return `${channelPrefix}:${tenantId}:events:${eventName}`;
  }

  /**
   * Wildcard Pub/Sub channel pattern for subscribing to all events in a tenant.
   * Pattern: `motus:{tenantId}:events:*`
   */
  static pubSubTenantWildcard(
    channelPrefix: string,
    tenantId: TenantId
  ): string {
    return `${channelPrefix}:${tenantId}:events:*`;
  }

  // ─── Expiry ZSET Member ────────────────────────────────────────────────────

  /** Composite member key for the session expiry ZSET. */
  static sessionExpiryMember(tenantId: TenantId, sessionId: SessionId): string {
    return `${tenantId}:${sessionId}`;
  }

  /** Parse a session expiry member back into tenantId and sessionId. */
  static parseExpiryMember(
    member: string
  ): { tenantId: TenantId; sessionId: SessionId } | null {
    const idx = member.indexOf(":");
    if (idx === -1) return null;
    return {
      tenantId: member.substring(0, idx) as TenantId,
      sessionId: member.substring(idx + 1) as SessionId,
    };
  }
}
