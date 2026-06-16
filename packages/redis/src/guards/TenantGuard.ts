/**
 * Guards all repository entry points against invalid or injection-prone tenant IDs.
 *
 * Enforces:
 * - Non-empty string
 * - No Redis key separator characters (`:`, `{`, `}`) that could escape the hashtag boundary
 */
export class TenantGuard {
  private static readonly INVALID_CHARS = /[:{}\s]/;

  /**
   * Validates a tenantId before any Redis operation.
   * @throws {Error} if tenantId is invalid or contains injection characters.
   */
  static validate(tenantId: string): void {
    if (
      !tenantId ||
      typeof tenantId !== "string" ||
      tenantId.trim().length === 0
    ) {
      throw new Error(
        `TenantGuard: tenantId must be a non-empty string. Received: ${JSON.stringify(
          tenantId
        )}`
      );
    }
    if (this.INVALID_CHARS.test(tenantId)) {
      throw new Error(
        `TenantGuard: tenantId "${tenantId}" contains invalid characters (:, {, }, whitespace). ` +
          `These characters can escape Redis key namespace boundaries.`
      );
    }
  }

  /**
   * Validates a driverId.
   * @throws {Error} if driverId is invalid.
   */
  static validateDriverId(driverId: string): void {
    if (
      !driverId ||
      typeof driverId !== "string" ||
      driverId.trim().length === 0
    ) {
      throw new Error(`TenantGuard: driverId must be a non-empty string.`);
    }
  }

  /**
   * Validates a sessionId.
   * @throws {Error} if sessionId is invalid.
   */
  static validateSessionId(sessionId: string): void {
    if (
      !sessionId ||
      typeof sessionId !== "string" ||
      sessionId.trim().length === 0
    ) {
      throw new Error(`TenantGuard: sessionId must be a non-empty string.`);
    }
  }
}
