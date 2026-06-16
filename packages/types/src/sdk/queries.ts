import { TenantScoped, DriverId, SessionId } from '@/domain/value-objects.js';

/**
 * Query to fetch tenant configuration properties.
 */
export type GetTenantQuery = TenantScoped;

/**
 * Query to retrieve driver presence and metadata.
 */
export interface GetDriverQuery extends TenantScoped {
  readonly driverId: DriverId;
}

/**
 * Query to fetch properties of a dispatch session.
 */
export interface GetSessionQuery extends TenantScoped {
  readonly sessionId: SessionId;
}

/**
 * Query to retrieve chronological session event records.
 */
export interface GetSessionEventsQuery extends TenantScoped {
  readonly sessionId: SessionId;
}

/**
 * Query to generate the final summarized telemetry report.
 */
export interface GetSessionReportQuery extends TenantScoped {
  readonly sessionId: SessionId;
}
