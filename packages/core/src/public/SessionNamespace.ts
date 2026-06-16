import {
  SessionNamespace as ISessionNamespace,
  CreateSessionCommand,
  CancelSessionCommand,
  CompleteSessionCommand,
  ReassignSessionCommand,
  SessionResult,
} from "@motus/types";
import { SessionManager } from "@/internal/managers/SessionManager.js";
import { IClock } from "@/internal/interfaces/ports.js";

export class SessionNamespace implements ISessionNamespace {
  constructor(
    private readonly sessionMgr: SessionManager,
    private readonly clock: IClock
  ) {}

  public async createSession(
    command: CreateSessionCommand
  ): Promise<SessionResult> {
    const session = await this.sessionMgr.createSession(command);
    return this.mapSessionToResult(session);
  }

  public async cancelSession(
    command: CancelSessionCommand
  ): Promise<SessionResult> {
    const session = await this.sessionMgr.cancelSession(command);
    return this.mapSessionToResult(session);
  }

  public async completeSession(
    command: CompleteSessionCommand
  ): Promise<SessionResult> {
    const session = await this.sessionMgr.completeSession(command);
    return this.mapSessionToResult(session);
  }

  public async reassignSession(
    command: ReassignSessionCommand
  ): Promise<SessionResult> {
    const session = await this.sessionMgr.reassignSession(command);
    return this.mapSessionToResult(session);
  }

  private mapSessionToResult(session: any): SessionResult {
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
}
