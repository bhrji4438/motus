import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startRedisTestContainer, flushTestRedis, type RedisTestContext } from '@/__tests__/helpers/RedisTestContainer.js';
import { RedisEventRepository } from '@/repositories/RedisEventRepository.js';
import type { SessionEvent } from '@motus/types';

const makeEvent = (overrides?: Partial<SessionEvent>): SessionEvent => ({
  eventId: `evt_${Math.random().toString(36).slice(2)}`,
  eventName: 'session.created',
  timestamp: new Date().toISOString(),
  payload: { sessionId: 'ses_001', tenantId: 'tnt_abc' },
  ...overrides,
});

describe('RedisEventRepository (integration)', () => {
  let ctx: RedisTestContext;
  let repo: RedisEventRepository;

  beforeAll(async () => {
    ctx = await startRedisTestContainer();
    repo = new RedisEventRepository(ctx.client);
  });

  afterAll(async () => {
    await ctx.manager.disconnect();
    await ctx.container.stop();
  });

  beforeEach(async () => {
    await flushTestRedis(ctx.client);
  });

  it('appends an event and retrieves it', async () => {
    const event = makeEvent();
    const streamId = await repo.appendEvent('tnt_abc', 'ses_001', event);
    expect(streamId).toBeTruthy();

    const events = await repo.getEvents('tnt_abc', 'ses_001');
    expect(events).toHaveLength(1);
    expect(events[0].eventId).toBe(event.eventId);
    expect(events[0].eventName).toBe('session.created');
  });

  it('maintains ordering of multiple events', async () => {
    for (let i = 1; i <= 5; i++) {
      await repo.appendEvent('tnt_abc', 'ses_001', makeEvent({ eventName: `event.${i}` as any }));
    }

    const events = await repo.getEvents('tnt_abc', 'ses_001');
    expect(events).toHaveLength(5);
    expect(events.map(e => e.eventName)).toEqual(['event.1', 'event.2', 'event.3', 'event.4', 'event.5']);
  });

  it('trims events to maxLen', async () => {
    for (let i = 0; i < 20; i++) {
      await repo.appendEvent('tnt_abc', 'ses_trim', makeEvent());
    }

    await repo.trimEvents('tnt_abc', 'ses_trim', 10, true);
    const count = await repo.countEvents('tnt_abc', 'ses_trim');
    expect(count).toBe(10);
  });

  it('deletes events stream', async () => {
    await repo.appendEvent('tnt_abc', 'ses_del', makeEvent());
    await repo.deleteEvents('tnt_abc', 'ses_del');
    const count = await repo.countEvents('tnt_abc', 'ses_del');
    expect(count).toBe(0);
  });

  it('returns recent events in reverse order', async () => {
    for (let i = 1; i <= 5; i++) {
      await repo.appendEvent('tnt_abc', 'ses_rev', makeEvent({ eventName: `event.${i}` as any }));
    }

    const recent = await repo.getRecentEvents('tnt_abc', 'ses_rev', 3);
    expect(recent).toHaveLength(3);
    expect(recent[0].eventName).toBe('event.5');
  });
});
