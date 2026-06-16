import { describe, it, expect, vi } from 'vitest';
import { InMemoryNotificationScheduler } from '@/scheduling/NotificationScheduler.js';

describe('NotificationScheduler', () => {
  it('should schedule notifications and prevent duplicates using idempotency keys', async () => {
    const scheduler = new InMemoryNotificationScheduler();
    scheduler.stop(); // Stop automatic interval loop for test control

    const payload = {
      recipientId: 'user-1',
      title: 'Scheduled Alert',
      body: 'Will send in 1 hour',
    };

    const runTime = new Date(Date.now() + 3600 * 1000);
    const key = 'test-idemp-1';

    const jobId1 = await scheduler.schedule('T1', payload, runTime, key);
    const jobId2 = await scheduler.schedule('T1', payload, runTime, key);

    expect(jobId1).toBe(jobId2); // Same job ID due to duplicate detection

    const pending = await scheduler.getPendingJobs('T1');
    expect(pending.length).toBe(1);
    expect(pending[0].status).toBe('scheduled');
  });

  it('should process pending jobs when they are due', async () => {
    const scheduler = new InMemoryNotificationScheduler();
    scheduler.stop();

    const payload = {
      recipientId: 'user-2',
      title: 'Due Alert',
      body: 'Send now',
    };

    // Schedule in the past so it is immediately due
    const runTime = new Date(Date.now() - 5000);
    await scheduler.schedule('T1', payload, runTime);

    const dispatcherSpy = vi.fn().mockResolvedValue({ success: true });
    const count = await scheduler.processPendingJobs(dispatcherSpy);

    expect(count).toBe(1);
    expect(dispatcherSpy).toHaveBeenCalledWith('T1', payload);

    const pending = await scheduler.getPendingJobs('T1');
    expect(pending.length).toBe(0); // Job is processed
  });
});
