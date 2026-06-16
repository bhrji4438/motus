import {
  QueryNamespace as IQueryNamespace,
  SessionResult,
  SessionReportResult,
  EventResult,
  TenantId,
  SessionId,
} from "@motus/types";
import { SessionManager } from "@/internal/managers/SessionManager.js";
import { IClock } from "@/internal/interfaces/ports.js";

export class QueryNamespace implements IQueryNamespace {
  private reportGen: any;

  constructor(
    private readonly sessionMgr: SessionManager,
    private readonly clock: IClock
  ) {}

  public setDependencies(reportGen: any): void {
    this.reportGen = reportGen;
  }

  public async getSession(
    tenantId: TenantId,
    sessionId: SessionId
  ): Promise<SessionResult> {
    const session = await this.sessionMgr.getSession(tenantId, sessionId);
    const nowStr = this.clock.now().toISOString();
    const res: any = {
      id: session.id,
      tenantId: session.tenantId,
      status: session.status,
      pickup: {
        latitude: session.pickupPoint.latitude,
        longitude: session.pickupPoint.longitude,
      },
      destination: {
        latitude: session.destinationPoint.latitude,
        longitude: session.destinationPoint.longitude,
      },
      createdAt: session.pickupPoint.timestamp || nowStr,
      updatedAt: nowStr,
    };
    if (
      session.assignedDriverId !== undefined &&
      session.assignedDriverId !== null
    ) {
      res.assignedDriverId = session.assignedDriverId;
    }
    return res;
  }

  public async getSessionEvents(
    tenantId: TenantId,
    sessionId: SessionId
  ): Promise<readonly EventResult[]> {
    const session = await this.sessionMgr.getSession(tenantId, sessionId);
    return (session.eventTimeline || []).map((evt) => ({
      tenantId,
      eventId: evt.eventId,
      eventName: evt.eventName,
      timestamp: evt.timestamp,
      payload: evt.payload,
    }));
  }

  public async getSessionReport(
    tenantId: TenantId,
    sessionId: SessionId
  ): Promise<SessionReportResult> {
    if (this.reportGen) {
      return await this.reportGen.getSessionReport(tenantId, sessionId);
    }
    throw new Error("Report generator not configured.");
  }
}
