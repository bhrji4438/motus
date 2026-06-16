export type DashboardRole =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "DISPATCHER"
  | "SUPPORT"
  | "ANALYST"
  | "VIEWER";

export type DashboardPermission =
  | "global.write"
  | "global.read"
  | "tenant.write"
  | "tenant.read"
  | "session.write"
  | "session.read"
  | "analytics.read"
  | "logs.read";

export const ROLE_PERMISSIONS: Record<DashboardRole, DashboardPermission[]> = {
  SUPER_ADMIN: [
    "global.write",
    "global.read",
    "tenant.write",
    "tenant.read",
    "session.write",
    "session.read",
    "analytics.read",
    "logs.read",
  ],
  ADMIN: [
    "tenant.write",
    "tenant.read",
    "session.write",
    "session.read",
    "analytics.read",
    "logs.read",
  ],
  DISPATCHER: ["session.write", "session.read", "tenant.read"],
  SUPPORT: ["session.read", "tenant.read", "logs.read"],
  ANALYST: ["tenant.read", "analytics.read"],
  VIEWER: ["tenant.read", "session.read"],
};

export interface DashboardUser {
  userId: string;
  role: DashboardRole;
  tenantId?: string; // Undefined for SUPER_ADMIN, specified for other roles
}

export interface MetricSummary {
  name: string;
  value: number;
  changePercent?: number;
}

export interface AnalyticsSummary {
  tenantId: string;
  totalSessions: number;
  successRate: number;
  averageMatchingLatencySec: number;
  waveTimeoutsCount: number;
  activeDriversCount: number;
}

export interface AuditRecord {
  id: string;
  tenantId: string;
  actorId: string;
  role: string;
  action: string;
  resource: string;
  details: string;
  timestamp: string;
}
