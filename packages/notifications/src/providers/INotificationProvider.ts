export interface ProviderCapabilities {
  supportsBulk: boolean;
  supportsTopics: boolean;
  platforms: ('ios' | 'android' | 'web')[];
}

export interface NotificationPayload {
  recipientId: string;
  targetToken?: string | undefined;
  topic?: string | undefined;
  title: string;
  body: string;
  data?: Record<string, string> | undefined;
  priority?: 'normal' | 'high' | undefined;
  ttl?: number | undefined;
}

export interface NotificationResult {
  success: boolean;
  providerName: string;
  messageId?: string;
  error?: string;
  timestamp: string;
}

export interface INotificationProvider {
  readonly name: string;
  readonly capabilities: ProviderCapabilities;
  send(payload: NotificationPayload): Promise<NotificationResult>;
  sendBulk?(payloads: NotificationPayload[]): Promise<NotificationResult[]>;
  checkHealth(): Promise<{ status: 'UP' | 'DOWN'; details?: Record<string, any> }>;
}
