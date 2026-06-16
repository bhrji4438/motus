import apn from "@parse/node-apn";
import {
  INotificationProvider,
  NotificationPayload,
  NotificationResult,
  ProviderCapabilities,
} from "@/providers/INotificationProvider.js";

export interface ApnsConfig {
  key?: string; // JWT Private key content
  keyId?: string;
  teamId?: string;
  bundleId?: string;
  production?: boolean;
  useMock?: boolean;
}

export class ApnsProvider implements INotificationProvider {
  public readonly name = "apns";
  public readonly capabilities: ProviderCapabilities = {
    supportsBulk: false, // APNS native client sends individual messages
    supportsTopics: false,
    platforms: ["ios"],
  };

  private provider?: apn.Provider;
  private bundleId: string | undefined;
  private useMock: boolean = true;

  constructor(config: ApnsConfig = {}) {
    this.useMock = config.useMock !== false;
    this.bundleId = config.bundleId;

    if (
      !this.useMock &&
      config.key &&
      config.keyId &&
      config.teamId &&
      config.bundleId
    ) {
      try {
        this.provider = new apn.Provider({
          token: {
            key: config.key.replace(/\\n/g, "\n"),
            keyId: config.keyId,
            teamId: config.teamId,
          },
          production: config.production || false,
        });
        this.useMock = false;
      } catch {
        this.useMock = true;
      }
    }
  }

  public async send(payload: NotificationPayload): Promise<NotificationResult> {
    const timestamp = new Date().toISOString();

    if (this.useMock) {
      return {
        success: true,
        providerName: this.name,
        messageId: `mock-apns-${Math.random().toString(36).substr(2, 9)}`,
        timestamp,
      };
    }

    try {
      if (!this.provider) throw new Error("APNS provider is not initialized");
      if (!payload.targetToken)
        throw new Error("APNS requires targetToken to be specified");

      const note = new apn.Notification();
      note.expiry = Math.floor(Date.now() / 1000) + (payload.ttl || 3600);
      note.badge = 1;
      note.sound = "ping.aiff";
      note.alert = {
        title: payload.title,
        body: payload.body,
      };
      note.payload = payload.data || {};
      note.topic = this.bundleId || "";
      note.priority = payload.priority === "high" ? 10 : 5;

      const response = await this.provider.send(note, payload.targetToken);

      if (response.failed && response.failed.length > 0) {
        const failInfo = response.failed[0];
        return {
          success: false,
          providerName: this.name,
          error: failInfo.response?.reason || "APNS sending failed",
          timestamp,
        };
      }

      return {
        success: true,
        providerName: this.name,
        messageId: response.sent[0]?.device || `apns-sent-${Date.now()}`,
        timestamp,
      };
    } catch (err: any) {
      return {
        success: false,
        providerName: this.name,
        error: err.message || String(err),
        timestamp,
      };
    }
  }

  public async checkHealth(): Promise<{
    status: "UP" | "DOWN";
    details?: Record<string, any>;
  }> {
    return {
      status: this.useMock || this.provider ? "UP" : "DOWN",
      details: {
        mockMode: this.useMock,
      },
    };
  }
}
