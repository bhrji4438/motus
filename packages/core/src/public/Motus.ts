import { MotusSDKClient } from "@motus/types";
import { TenantNamespace } from "@/public/TenantNamespace.js";
import { DriverNamespace } from "@/public/DriverNamespace.js";
import { SessionNamespace } from "@/public/SessionNamespace.js";
import { QueryNamespace } from "@/public/QueryNamespace.js";
import { EventNamespace } from "@/public/EventNamespace.js";
import { TenantManager } from "@/internal/managers/TenantManager.js";
import { DriverManager } from "@/internal/managers/DriverManager.js";
import { SessionManager } from "@/internal/managers/SessionManager.js";
import { IClock } from "@/internal/interfaces/ports.js";

export class Motus implements MotusSDKClient {
  public readonly tenant: TenantNamespace;
  public readonly driver: DriverNamespace;
  public readonly session: SessionNamespace;
  public readonly query: QueryNamespace;
  public readonly events: EventNamespace;

  constructor(
    tenantMgr: TenantManager,
    driverMgr: DriverManager,
    sessionMgr: SessionManager,
    clock: IClock,
    eventDispatcher?: any
  ) {
    this.tenant = new TenantNamespace(tenantMgr);
    this.driver = new DriverNamespace(driverMgr);
    this.session = new SessionNamespace(sessionMgr, clock);
    this.query = new QueryNamespace(sessionMgr, clock);
    this.events = new EventNamespace();
    if (eventDispatcher) {
      this.events.setDependencies(eventDispatcher);
    }
  }
}
