import { DashboardRole, DashboardPermission, ROLE_PERMISSIONS, DashboardUser } from '@/types/contracts.js';

export class RbacGuard {
  /**
   * Parse auth headers and extract dashboard user information.
   * For local demonstration, supports parsing X-User-Role and X-Tenant-ID headers.
   */
  public static authenticateRequest(headers: Record<string, string | string[] | undefined>): DashboardUser | null {
    const roleHeader = headers['x-user-role'] as string;
    const tenantHeader = headers['x-tenant-id'] as string;

    if (!roleHeader) {
      // If no custom header, check standard Bearer authorization (simulated)
      const auth = headers['authorization'] as string;
      if (auth && auth.startsWith('Bearer ')) {
        const token = auth.substring(7);
        // Simple token decoder mockup
        if (token === 'super-admin-token') {
          return { userId: 'admin-1', role: 'SUPER_ADMIN' };
        }
      }
      return null;
    }

    return {
      userId: 'user-id-from-headers',
      role: roleHeader.toUpperCase() as DashboardRole,
      tenantId: tenantHeader,
    };
  }

  /**
   * Validate if a user is authorized for a permission and tenant context.
   */
  public static authorize(
    user: DashboardUser,
    requiredPermission: DashboardPermission,
    targetTenantId?: string
  ): boolean {
    const permissions = ROLE_PERMISSIONS[user.role];
    if (!permissions) return false;

    // 1. Verify global permission
    const hasPermission = permissions.includes(requiredPermission);
    if (!hasPermission) return false;

    // 2. Super admins can access any tenant context
    if (user.role === 'SUPER_ADMIN') return true;

    // 3. Verify tenant boundary match
    if (targetTenantId && user.tenantId !== targetTenantId) {
      return false;
    }

    return true;
  }
}
