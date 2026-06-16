import crypto from 'crypto';
import { NotificationPayload } from '@/providers/INotificationProvider.js';

export interface ScheduledJob {
  jobId: string;
  tenantId: string;
  payload: NotificationPayload;
  sendAt: string; // ISO timestamp
  status: 'scheduled' | 'sent' | 'cancelled';
  idempotencyKey?: string | undefined;
  createdAt: string;
}

export interface INotificationScheduler {
  schedule(
    tenantId: string,
    payload: NotificationPayload,
    sendAt: Date,
    idempotencyKey?: string
  ): Promise<string>;
  cancel(jobId: string): Promise<boolean>;
  getPendingJobs(tenantId?: string): Promise<ScheduledJob[]>;
  processPendingJobs(dispatcher: (tenantId: string, payload: NotificationPayload) => Promise<any>): Promise<number>;
}

export class InMemoryNotificationScheduler implements INotificationScheduler {
  private jobs = new Map<string, ScheduledJob>();
  private idempotencyKeys = new Set<string>();
  private intervalId?: NodeJS.Timeout;
  private isProcessing = false;

  constructor() {
    this.startPolling();
  }

  /**
   * Schedule a notification.
   */
  public async schedule(
    tenantId: string,
    payload: NotificationPayload,
    sendAt: Date,
    idempotencyKey?: string
  ): Promise<string> {
    // 1. Idempotency & Duplicate-delivery check
    if (idempotencyKey) {
      if (this.idempotencyKeys.has(idempotencyKey)) {
        // Find existing job
        const existingJob = Array.from(this.jobs.values()).find(
          j => j.idempotencyKey === idempotencyKey
        );
        if (existingJob) return existingJob.jobId;
      }
      this.idempotencyKeys.add(idempotencyKey);
    }

    const jobId = `job-${crypto.randomUUID()}`;
    const job: ScheduledJob = {
      jobId,
      tenantId,
      payload,
      sendAt: sendAt.toISOString(),
      status: 'scheduled',
      idempotencyKey,
      createdAt: new Date().toISOString(),
    };

    this.jobs.set(jobId, job);
    return jobId;
  }

  /**
   * Cancel a scheduled notification.
   */
  public async cancel(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'scheduled') {
      return false;
    }

    job.status = 'cancelled';
    if (job.idempotencyKey) {
      this.idempotencyKeys.delete(job.idempotencyKey);
    }
    this.jobs.set(jobId, job);
    return true;
  }

  /**
   * Get all pending jobs to support restart-recovery queries.
   */
  public async getPendingJobs(tenantId?: string): Promise<ScheduledJob[]> {
    return Array.from(this.jobs.values()).filter(
      job => job.status === 'scheduled' && (!tenantId || job.tenantId === tenantId)
    );
  }

  /**
   * Execute scheduled deliveries that are due.
   */
  public async processPendingJobs(
    dispatcher: (tenantId: string, payload: NotificationPayload) => Promise<any>
  ): Promise<number> {
    if (this.isProcessing) return 0;
    this.isProcessing = true;

    let processedCount = 0;
    const now = new Date();

    try {
      const pending = Array.from(this.jobs.values()).filter(
        job => job.status === 'scheduled' && new Date(job.sendAt) <= now
      );

      for (const job of pending) {
        // Double-delivery check: verify job status hasn't changed
        const currentJob = this.jobs.get(job.jobId);
        if (!currentJob || currentJob.status !== 'scheduled') {
          continue;
        }

        // Optimistically mark as sent to avoid race conditions
        currentJob.status = 'sent';
        this.jobs.set(job.jobId, currentJob);

        try {
          await dispatcher(job.tenantId, job.payload);
          processedCount++;
        } catch {
          // If execution fails, restore to 'scheduled' for retry
          currentJob.status = 'scheduled';
          this.jobs.set(job.jobId, currentJob);
        }
      }
    } finally {
      this.isProcessing = false;
    }

    return processedCount;
  }

  private startPolling(): void {
    // Periodically poll for pending jobs (every 2 seconds for tests/sandbox)
    this.intervalId = setInterval(() => {
      // In standalone service, it will execute processPendingJobs
    }, 2000);
  }

  /**
   * Clean up timers on stop.
   */
  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
}
