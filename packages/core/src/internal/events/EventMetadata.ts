import { TenantId } from "@motus/types";

export class EventMetadata {
  public validateEventId(eventId: string): boolean {
    // Basic UUIDv4 regex pattern check
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(eventId);
  }

  public validateTimestamp(timestamp: string): boolean {
    // ISO 8601 UTC timestamp check
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
    if (!isoRegex.test(timestamp)) {
      return false;
    }
    const d = new Date(timestamp);
    return !isNaN(d.getTime());
  }

  public validateTenantId(tenantId: TenantId): boolean {
    // Tenant ID prefix format: tnt_[a-zA-Z0-9_-]{1,60}
    const tenantRegex = /^tnt_[a-zA-Z0-9_-]{1,60}$/;
    return tenantRegex.test(tenantId);
  }
}
