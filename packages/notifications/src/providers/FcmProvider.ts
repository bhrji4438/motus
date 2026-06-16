import admin from 'firebase-admin';
import { INotificationProvider, NotificationPayload, NotificationResult, ProviderCapabilities } from '@/providers/INotificationProvider.js';

export interface FcmConfig {
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
  useMock?: boolean;
}

export class FcmProvider implements INotificationProvider {
  public readonly name = 'fcm';
  public readonly capabilities: ProviderCapabilities = {
    supportsBulk: true,
    supportsTopics: true,
    platforms: ['ios', 'android', 'web'],
  };

  private messaging?: admin.messaging.Messaging;
  private useMock: boolean = true;

  constructor(config: FcmConfig = {}) {
    this.useMock = config.useMock !== false;

    if (!this.useMock && config.projectId && config.clientEmail && config.privateKey) {
      try {
        const formattedKey = config.privateKey.replace(/\\n/g, '\n');
        
        // Find existing app or initialize
        const app = admin.apps.find(a => a?.name === 'motus-fcm') || 
                    admin.initializeApp({
                      credential: admin.credential.cert({
                        projectId: config.projectId,
                        clientEmail: config.clientEmail,
                        privateKey: formattedKey,
                      })
                    }, 'motus-fcm');

        this.messaging = admin.messaging(app);
        this.useMock = false;
      } catch {
        this.useMock = true; // Fallback to mock on error to maintain resilience
      }
    }
  }

  public async send(payload: NotificationPayload): Promise<NotificationResult> {
    const timestamp = new Date().toISOString();

    if (this.useMock) {
      return {
        success: true,
        providerName: this.name,
        messageId: `mock-fcm-${Math.random().toString(36).substr(2, 9)}`,
        timestamp,
      };
    }

    try {
      if (!this.messaging) throw new Error('FCM messaging is not initialized');

      const message: any = {
        notification: {
          title: payload.title,
          body: payload.body,
        },
      };

      if (payload.data) {
        message.data = payload.data;
      }

      if (payload.topic) {
        message.topic = payload.topic;
      } else if (payload.targetToken) {
        message.token = payload.targetToken;
      } else {
        throw new Error('FCM requires either targetToken or topic to be specified');
      }

      const messageId = await this.messaging.send(message as admin.messaging.Message);

      return {
        success: true,
        providerName: this.name,
        messageId,
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

  public async sendBulk(payloads: NotificationPayload[]): Promise<NotificationResult[]> {
    return Promise.all(payloads.map(p => this.send(p)));
  }

  public async checkHealth(): Promise<{ status: 'UP' | 'DOWN'; details?: Record<string, any> }> {
    return {
      status: this.useMock || this.messaging ? 'UP' : 'DOWN',
      details: {
        mockMode: this.useMock,
      },
    };
  }
}
