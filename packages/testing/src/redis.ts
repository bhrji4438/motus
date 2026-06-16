import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { Redis } from 'ioredis';

export interface SharedRedisTestContext {
  container: StartedTestContainer;
  client: Redis;
  port: number;
  host: string;
  url: string;
}

/**
 * Spins up a real Redis container using testcontainers for integration/E2E testing.
 */
export async function startSharedRedisContainer(): Promise<SharedRedisTestContext> {
  const container = await new GenericContainer('redis:7.2-alpine')
    .withExposedPorts(6379)
    .withCommand(['redis-server', '--save', '', '--appendonly', 'no'])
    .start();

  const host = container.getHost();
  const port = container.getMappedPort(6379);
  const url = `redis://${host}:${port}`;
  const client = new Redis(url);

  return {
    container,
    client,
    port,
    host,
    url,
  };
}

export async function flushRedisContainer(client: Redis): Promise<void> {
  await client.flushall();
}
