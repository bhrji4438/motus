import { INotificationProvider, NotificationPayload, NotificationResult } from '@/providers/INotificationProvider.js';
import { TemplateManager } from '@/templates/TemplateManager.js';
import { INotificationPreferenceStore, InMemoryPreferenceStore } from '@/preferences/PreferenceStore.js';
import { TargetingEngine } from '@/targeting/TargetingEngine.js';
import { IDeliveryTracker, InMemoryDeliveryTracker } from '@/delivery/DeliveryTracker.js';
import { INotificationScheduler, InMemoryNotificationScheduler } from '@/scheduling/NotificationScheduler.js';

export interface NotificationServiceOptions {
  providers: INotificationProvider[];
  preferenceStore?: INotificationPreferenceStore;
  targetingEngine?: TargetingEngine;
  deliveryTracker?: IDeliveryTracker;
  scheduler?: INotificationScheduler;
  maxRetries?: number;
  rateLimitMs?: number; // Minimum gap between notifications per recipient
}

export class NotificationService {
  private providers = new Map<string, INotificationProvider>();
  private templateManager = new TemplateManager();
  private preferenceStore: INotificationPreferenceStore;
  private targetingEngine: TargetingEngine;
  private deliveryTracker: IDeliveryTracker;
  private scheduler: INotificationScheduler;
  private maxRetries: number;
  private rateLimitMs: number;
  
  // Rate limiting storage: recipientId -> last sent time
  private lastSentTimes = new Map<string, number>();

  constructor(options: NotificationServiceOptions) {
    options.providers.forEach(p => this.providers.set(p.name, p));
    this.preferenceStore = options.preferenceStore || new InMemoryPreferenceStore();
    this.targetingEngine = options.targetingEngine || new TargetingEngine();
    this.deliveryTracker = options.deliveryTracker || new InMemoryDeliveryTracker();
    this.scheduler = options.scheduler || new InMemoryNotificationScheduler();
    this.maxRetries = options.maxRetries !== undefined ? options.maxRetries : 3;
    this.rateLimitMs = options.rateLimitMs || 1000; // 1 second default threshold
  }

  public getTemplates(): TemplateManager {
    return this.templateManager;
  }

  public getScheduler(): INotificationScheduler {
    return this.scheduler;
  }

  public getTargetingEngine(): TargetingEngine {
    return this.targetingEngine;
  }

  public getDeliveryTracker(): IDeliveryTracker {
    return this.deliveryTracker;
  }

  /**
   * Main Send function: executes preference verification, checks rate limits,
   * resolves active target device tokens, runs provider routing, retries, and records status receipts.
   */
  public async send(tenantId: string, recipientId: string, title: string, body: string, data?: Record<string, string>): Promise<NotificationResult> {
    const timestamp = new Date().toISOString();

    // 1. Preference Validation
    const isAllowed = await this.preferenceStore.isAllowed(recipientId, 'push');
    if (!isAllowed) {
      return {
        success: false,
        providerName: 'none',
        error: `User preference opted-out of push notifications`,
        timestamp,
      };
    }

    // 2. Rate Limiting Check
    const now = Date.now();
    const lastSent = this.lastSentTimes.get(recipientId) || 0;
    if (now - lastSent < this.rateLimitMs) {
      return {
        success: false,
        providerName: 'none',
        error: `Rate limit exceeded for recipient '${recipientId}'`,
        timestamp,
      };
    }
    this.lastSentTimes.set(recipientId, now);

    // 3. Resolve Target Tokens
    const devices = await this.targetingEngine.getTokensForUser(tenantId, recipientId);
    if (devices.length === 0) {
      // Return a mock result to allow graceful execution when no devices are registered
      return {
        success: false,
        providerName: 'none',
        error: `No registered device tokens found for recipient '${recipientId}'`,
        timestamp,
      };
    }

    // Select the best device token and route it
    const primaryDevice = devices[0];
    const payload: NotificationPayload = {
      recipientId,
      targetToken: primaryDevice.token,
      title,
      body,
      data,
    };

    // 4. Create Delivery Receipt
    const receipt = await this.deliveryTracker.createReceipt(tenantId, payload, 'push');

    // 5. Select provider based on routing options and capabilities
    const providersQueue = this.determineProviderRouting(primaryDevice.platform);
    
    let lastResult: NotificationResult = {
      success: false,
      providerName: 'none',
      error: 'No compatible provider found',
      timestamp,
    };

    // 6. Failover & Retry Pipeline
    for (const provider of providersQueue) {
      // Check provider health before making external call
      const health = await provider.checkHealth();
      if (health.status === 'DOWN') {
        continue; // Fallback to next provider in queue
      }

      let attempt = 0;
      let sentSuccess = false;

      while (attempt < this.maxRetries && !sentSuccess) {
        attempt++;
        try {
          const result = await provider.send(payload);
          await this.deliveryTracker.recordAttempt(receipt.receiptId, result);
          lastResult = result;

          if (result.success) {
            sentSuccess = true;
            break;
          } else {
            // Record token failure in targeting engine
            await this.targetingEngine.recordFailure(tenantId, recipientId, primaryDevice.token);
          }
        } catch (err: any) {
          lastResult = {
            success: false,
            providerName: provider.name,
            error: err.message || String(err),
            timestamp: new Date().toISOString(),
          };
        }

        // Simple exponential backoff delay before next retry
        if (!sentSuccess && attempt < this.maxRetries) {
          await new Promise(res => setTimeout(res, Math.pow(2, attempt) * 100));
        }
      }

      if (sentSuccess) {
        break; // Failover success, terminate chain
      }
    }

    return lastResult;
  }

  /**
   * Helper function: Interpolate templates and dispatch notification.
   */
  public async sendWithTemplate(
    tenantId: string,
    recipientId: string,
    templateId: string,
    variables: Record<string, string>,
    data?: Record<string, string>
  ): Promise<NotificationResult> {
    const rendered = this.templateManager.render(templateId, variables);
    return this.send(tenantId, recipientId, rendered.title, rendered.body, data);
  }

  /**
   * Scheduled send. Saves in scheduling queue for later polling/evaluation.
   */
  public async schedule(
    tenantId: string,
    recipientId: string,
    title: string,
    body: string,
    sendAt: Date,
    idempotencyKey?: string,
    data?: Record<string, string>
  ): Promise<string> {
    const payload: NotificationPayload = { recipientId, title, body, data };
    return this.scheduler.schedule(tenantId, payload, sendAt, idempotencyKey);
  }

  /**
   * Determine provider queue order based on platform and health checks.
   */
  private determineProviderRouting(platform: 'ios' | 'android' | 'web'): INotificationProvider[] {
    const queue: INotificationProvider[] = [];

    // Prioritize providers natively matching the target device platform
    if (platform === 'ios') {
      const apns = this.providers.get('apns');
      if (apns) queue.push(apns);
    } else {
      const fcm = this.providers.get('fcm');
      if (fcm) queue.push(fcm);
    }

    // Add remaining fallback providers
    this.providers.forEach(provider => {
      if (!queue.includes(provider) && provider.capabilities.platforms.includes(platform)) {
        queue.push(provider);
      }
    });

    return queue;
  }
}
