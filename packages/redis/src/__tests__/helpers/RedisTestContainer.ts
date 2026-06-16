import { GenericContainer, type StartedTestContainer } from "testcontainers";
import { Redis } from "ioredis";
import { RedisClientManager } from "@/client/RedisClientManager.js";
import { DEFAULT_MOTUS_REDIS_CONFIG } from "@/config/index.js";

/**
 * Testcontainers helper for spinning up a real Redis 7.2 instance per test suite.
 *
 * Usage:
 *   let container: StartedTestContainer;
 *   let manager: RedisClientManager;
 *
 *   beforeAll(async () => {
 *     ({ container, manager } = await startRedisTestContainer());
 *   });
 *   afterAll(async () => {
 *     await manager.disconnect();
 *     await container.stop();
 *   });
 */
export interface RedisTestContext {
  container: StartedTestContainer;
  manager: RedisClientManager;
  client: Redis;
}

export async function startRedisTestContainer(): Promise<RedisTestContext> {
  const container = await new GenericContainer("redis:7.2-alpine")
    .withExposedPorts(6379)
    .withCommand(["redis-server", "--save", "", "--appendonly", "no"])
    .start();

  const host = container.getHost();
  const port = container.getMappedPort(6379);

  const manager = new RedisClientManager({
    ...DEFAULT_MOTUS_REDIS_CONFIG,
    connection: {
      ...DEFAULT_MOTUS_REDIS_CONFIG.connection,
      host,
      port,
    },
  });

  await manager.connect();

  return { container, manager, client: manager.client as Redis };
}

/** Flushes all data in the test Redis instance. */
export async function flushTestRedis(client: Redis): Promise<void> {
  await client.flushall();
}
