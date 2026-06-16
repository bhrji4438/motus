export interface NotificationLog {
  messageId: string;
  tenantId: string;
  recipientId: string;
  title: string;
  body: string;
  provider: string;
  status: "sent" | "failed" | "scheduled";
  error?: string;
  timestamp: string;
}

export class NotificationMonitor {
  private logs: NotificationLog[] = [];

  constructor() {
    this.logs.push({
      messageId: "fcm-msg-1",
      tenantId: "T1",
      recipientId: "driver-1",
      title: "Session Assigned",
      body: "Session S100 is assigned to you",
      provider: "fcm",
      status: "sent",
      timestamp: new Date().toISOString(),
    });
    this.logs.push({
      messageId: "apns-msg-2",
      tenantId: "T1",
      recipientId: "driver-2",
      title: "Dispatch Wave Started",
      body: "Session S101 has candidate positions",
      provider: "apns",
      status: "failed",
      error: "APNS device token expired",
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * List logs for a given tenant context.
   */
  public async getLogs(tenantId: string): Promise<NotificationLog[]> {
    return this.logs.filter((log) => log.tenantId === tenantId);
  }

  public recordDelivery(
    tenantId: string,
    recipientId: string,
    title: string,
    body: string,
    provider: string,
    status: "sent" | "failed",
    error?: string
  ): void {
    const log: NotificationLog = {
      messageId: `msg-${Math.random().toString(36).substr(2, 9)}`,
      tenantId,
      recipientId,
      title,
      body,
      provider,
      status,
      timestamp: new Date().toISOString(),
    };
    if (error !== undefined) {
      log.error = error;
    }
    this.logs.unshift(log);
  }
}

// Global default instance
export const defaultNotificationMonitor = new NotificationMonitor();
export default defaultNotificationMonitor;
