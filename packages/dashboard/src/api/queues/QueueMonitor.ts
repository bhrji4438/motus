export interface QueueDetail {
  queueName: string;
  tenantId: string;
  size: number;
  backlogCount: number;
  consumerGroupsCount: number;
  activeWorkersCount: number;
}

export class QueueMonitor {
  private queues = new Map<string, QueueDetail>();

  constructor() {
    this.queues.set('T1:dispatch-stream', {
      queueName: 'dispatch-stream',
      tenantId: 'T1',
      size: 142,
      backlogCount: 3,
      consumerGroupsCount: 2,
      activeWorkersCount: 4,
    });
    this.queues.set('T1:telemetry-stream', {
      queueName: 'telemetry-stream',
      tenantId: 'T1',
      size: 12450,
      backlogCount: 0,
      consumerGroupsCount: 1,
      activeWorkersCount: 8,
    });
  }

  /**
   * List queues for a given tenant context.
   */
  public async getTenantQueues(tenantId: string): Promise<QueueDetail[]> {
    return Array.from(this.queues.values()).filter(q => q.tenantId === tenantId);
  }

  /**
   * Record stream changes.
   */
  public updateQueueSize(tenantId: string, queueName: string, size: number, backlog: number): void {
    const key = `${tenantId}:${queueName}`;
    const q = this.queues.get(key) || {
      queueName,
      tenantId,
      size,
      backlogCount: backlog,
      consumerGroupsCount: 1,
      activeWorkersCount: 1,
    };
    q.size = size;
    q.backlogCount = backlog;
    this.queues.set(key, q);
  }
}

// Global default queue monitor
export const defaultQueueMonitor = new QueueMonitor();
export default defaultQueueMonitor;
