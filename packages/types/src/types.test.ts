import { describe, it, expectTypeOf } from 'vitest';
import { ServerConfig, RedisConfig, SocketConfig } from '@/index.js';

describe('Type-level Compile-time Compatibility Tests', () => {
  it('should validate ServerConfig contract', () => {
    expectTypeOf<ServerConfig>().toHaveProperty('port').toBeNumber();
    expectTypeOf<ServerConfig>().toHaveProperty('host').toBeString();
    expectTypeOf<ServerConfig>().toHaveProperty('jwtSecret').toBeString();
    expectTypeOf<ServerConfig>().toHaveProperty('logLevel').toEqualTypeOf<'debug' | 'info' | 'warn' | 'error'>();
  });

  it('should validate RedisConfig contract', () => {
    expectTypeOf<RedisConfig>().toHaveProperty('nodes').toEqualTypeOf<readonly string[]>();
    expectTypeOf<RedisConfig>().toHaveProperty('clusterMode').toBeBoolean();
    expectTypeOf<RedisConfig>().toHaveProperty('maxConnections').toBeNumber();
  });

  it('should validate SocketConfig contract', () => {
    expectTypeOf<SocketConfig>().toHaveProperty('path').toBeString();
    expectTypeOf<SocketConfig>().toHaveProperty('pingInterval').toBeNumber();
    expectTypeOf<SocketConfig>().toHaveProperty('pingTimeout').toBeNumber();
  });
});
