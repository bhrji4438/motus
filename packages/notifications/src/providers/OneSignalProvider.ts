import {
  INotificationProvider,
  NotificationPayload,
  NotificationResult,
  ProviderCapabilities,
} from "@/providers/INotificationProvider.js";

export interface OneSignalConfig {
  appId?: string;
  apiKey?: string;
  useMock?: boolean;
}

export class OneSignalProvider implements INotificationProvider {
  public readonly name = "onesignal";
  public readonly capabilities: ProviderCapabilities = {
    supportsBulk: true,
    supportsTopics: true,
    platforms: ["ios", "android", "web"],
  };

  private appId: string | undefined;
  private apiKey: string | undefined;
  private useMock: boolean = true;

  constructor(config: OneSignalConfig = {}) {
    this.useMock = config.useMock !== false;
    this.appId = config.appId;
    this.apiKey = config.apiKey;

    if (!this.useMock && config.appId && config.apiKey) {
      this.useMock = false;
    }
  }

  public async send(payload: NotificationPayload): Promise<NotificationResult> {
    const timestamp = new Date().toISOString();

    if (this.useMock) {
      return {
        success: true,
        providerName: this.name,
        messageId: `mock-onesignal-${Math.random().toString(36).substr(2, 9)}`,
        timestamp,
      };
    }

    try {
      if (!this.appId || !this.apiKey) {
        throw new Error("OneSignal appId or apiKey is missing");
      }

      // OneSignal POST /notifications payload mapping
      const bodyPayload: Record<string, any> = {
        app_id: this.appId,
        headings: { en: payload.title },
        contents: { en: payload.body },
        data: payload.data,
      };

      if (payload.topic) {
        // Topic corresponds to tags in OneSignal
        bodyPayload.filters = [
          { field: "tag", key: "topic", relation: "=", value: payload.topic },
        ];
      } else if (payload.targetToken) {
        bodyPayload.include_subscription_ids = [payload.targetToken];
      } else {
        throw new Error(
          "OneSignal requires targetToken or topic tag for targeting"
        );
      }

      const res = await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Authorization: `Basic ${this.apiKey}`,
        },
        body: JSON.stringify(bodyPayload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(
          `OneSignal REST API failed with status ${res.status}: ${errText}`
        );
      }

      const resJson = (await res.json()) as any;
      if (resJson.errors) {
        throw new Error(JSON.stringify(resJson.errors));
      }

      return {
        success: true,
        providerName: this.name,
        messageId: resJson.id,
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
      status: this.useMock || (this.appId && this.apiKey) ? "UP" : "DOWN",
      details: {
        mockMode: this.useMock,
      },
    };
  }
}
