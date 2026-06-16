import { describe, it, expect } from 'vitest';
import { RbacGuard } from '@/auth/RbacGuard.js';
import { DashboardUser } from '@/types/contracts.js';

describe('RbacGuard', () => {
  it('should authenticate user from custom headers', () => {
    const headers = {
      'x-user-role': 'admin',
      'x-tenant-id': 'T1',
    };

    const user = RbacGuard.authenticateRequest(headers);
    expect(user).toBeDefined();
    expect(user?.role).toBe('ADMIN');
    expect(user?.tenantId).toBe('T1');
  });

  it('should deny request if permission is missing in role schema', () => {
    const dispatcherUser: DashboardUser = {
      userId: 'disp-1',
      role: 'DISPATCHER',
      tenantId: 'T1',
    };

    // Dispatchers can read/write sessions but NOT audit logs or system analytics
    expect(RbacGuard.authorize(dispatcherUser, 'session.read', 'T1')).toBe(true);
    expect(RbacGuard.authorize(dispatcherUser, 'session.write', 'T1')).toBe(true);
    expect(RbacGuard.authorize(dispatcherUser, 'logs.read', 'T1')).toBe(false);
  });

  it('should validate tenant boundary scopes correctly', () => {
    const adminUser: DashboardUser = {
      userId: 'admin-1',
      role: 'ADMIN',
      tenantId: 'T1',
    };

    // Admin should be authorized for tenant T1 but rejected for tenant T2 (multi-tenant boundary checks)
    expect(RbacGuard.authorize(adminUser, 'session.read', 'T1')).toBe(true);
    expect(RbacGuard.authorize(adminUser, 'session.read', 'T2')).toBe(false);
  });

  it('should bypass tenant restrictions for SUPER_ADMIN role', () => {
    const superAdminUser: DashboardUser = {
      userId: 'sa-1',
      role: 'SUPER_ADMIN',
    };

    expect(RbacGuard.authorize(superAdminUser, 'session.read', 'T2')).toBe(true);
    expect(RbacGuard.authorize(superAdminUser, 'logs.read', 'T2')).toBe(true);
  });
});
