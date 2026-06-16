import type { Redis, Cluster } from 'ioredis';

/**
 * Registry of all Lua scripts used by @motus/redis.
 *
 * Scripts are defined as inline strings and registered on the ioredis client
 * via defineCommand. This avoids file-system loading at runtime and ensures
 * scripts are always available in the bundled package.
 *
 * All scripts are defined as static readonly strings and registered once during
 * RedisClientManager initialization.
 */
export class LuaScriptRegistry {
  /**
   * Acquires a distributed lock using SET NX PX.
   *
   * KEYS[1] = lock key
   * ARGV[1] = owner token (UUID v4)
   * ARGV[2] = TTL in milliseconds
   *
   * Returns: 1 if lock acquired, 0 if already held.
   */
  static readonly ACQUIRE_LOCK = `
    local result = redis.call('SET', KEYS[1], ARGV[1], 'NX', 'PX', ARGV[2])
    if result then return 1 else return 0 end
  `;

  /**
   * Releases a distributed lock only if the owner token matches.
   *
   * KEYS[1] = lock key
   * ARGV[1] = owner token
   *
   * Returns: 1 if released, 0 if owner mismatch (lock held by another).
   */
  static readonly RELEASE_LOCK = `
    local current = redis.call('GET', KEYS[1])
    if current == ARGV[1] then
      redis.call('DEL', KEYS[1])
      return 1
    else
      return 0
    end
  `;

  /**
   * Renews a lock TTL only if the owner token matches.
   *
   * KEYS[1] = lock key
   * ARGV[1] = owner token
   * ARGV[2] = new TTL in milliseconds
   *
   * Returns: 1 if renewed, 0 if owner mismatch or key expired.
   */
  static readonly RENEW_LOCK = `
    local current = redis.call('GET', KEYS[1])
    if current == ARGV[1] then
      redis.call('PEXPIRE', KEYS[1], ARGV[2])
      return 1
    else
      return 0
    end
  `;

  /**
   * Atomically writes a driver hash, updates the geo-index, and updates the
   * presence sorted set. All three keys must share the same hash slot (via
   * {tenantId} hashtag).
   *
   * KEYS[1] = driver hash key
   * KEYS[2] = geo index key
   * KEYS[3] = presence ZSET key
   * ARGV[1..N] = driver hash field-value pairs (flat list, even count)
   *              followed by sentinel "___END___"
   * ARGV[N+1] = longitude
   * ARGV[N+2] = latitude
   * ARGV[N+3] = driverId (geo member name)
   * ARGV[N+4] = heartbeat score (Unix ms as string)
   * ARGV[N+5] = driverId (presence ZSET member)
   */
  static readonly SAVE_DRIVER_ATOMIC = `
    -- Parse field-value pairs up to sentinel
    local i = 1
    local hmset_args = {}
    while ARGV[i] ~= '___END___' do
      table.insert(hmset_args, ARGV[i])
      i = i + 1
    end
    i = i + 1  -- skip sentinel

    -- Write driver hash
    redis.call('HSET', KEYS[1], unpack(hmset_args))

    -- Update geo index
    local lon = ARGV[i]
    local lat = ARGV[i+1]
    local geoMember = ARGV[i+2]
    redis.call('GEOADD', KEYS[2], lon, lat, geoMember)

    -- Update presence ZSET with heartbeat score
    local score = ARGV[i+3]
    local presenceMember = ARGV[i+4]
    redis.call('ZADD', KEYS[3], score, presenceMember)

    return 1
  `;

  /**
   * Scans the session expiry ZSET for sessions whose expiry time has passed.
   * Returns a batch of member strings (tenantId:sessionId) for pruning.
   *
   * KEYS[1] = motus:sessions:expiry
   * ARGV[1] = current Unix timestamp in ms (string)
   * ARGV[2] = batch size (max members to return)
   *
   * Returns: array of member strings, or empty array if none expired.
   */
  static readonly EXPIRE_SESSION_SCAN = `
    local now = tonumber(ARGV[1])
    local batchSize = tonumber(ARGV[2])
    local members = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', now, 'LIMIT', 0, batchSize)
    return members
  `;

  /**
   * Atomically prunes a terminal session: deletes the session hash, telemetry
   * stream, and event stream, then removes the entry from the expiry ZSET.
   *
   * All session keys share the same hash slot via {tenantId} hashtag.
   * The expiry ZSET is a separate single-key operation (different slot).
   * Because we cannot mix slots in Lua, this script operates on ONLY the
   * three tenant-scoped session keys. The expiry ZSET entry is removed by
   * the caller after a successful pruneSessionData call.
   *
   * KEYS[1] = session hash key
   * KEYS[2] = telemetry stream key
   * KEYS[3] = event stream key
   *
   * Returns: 1 always.
   */
  static readonly PRUNE_SESSION_DATA = `
    redis.call('DEL', KEYS[1])
    redis.call('DEL', KEYS[2])
    redis.call('DEL', KEYS[3])
    return 1
  `;

  /**
   * Compare-and-swap (CAS) for driver status field.
   * Reads the current status and only writes the new status if the current
   * matches the expected value. Prevents invalid state transitions at storage layer.
   *
   * KEYS[1] = driver hash key
   * ARGV[1] = expected current status string
   * ARGV[2] = new status string
   *
   * Returns: 1 if updated, 0 if status did not match (already transitioned).
   */
  static readonly DRIVER_STATUS_CAS = `
    local current = redis.call('HGET', KEYS[1], 'status')
    if current == ARGV[1] then
      redis.call('HSET', KEYS[1], 'status', ARGV[2])
      return 1
    else
      return 0
    end
  `;

  /**
   * Registers all Lua scripts as custom ioredis commands on the client.
   * Must be called once during RedisClientManager.connect().
   */
  static register(client: Redis | Cluster): void {
    (client as any).defineCommand('motusAcquireLock', {
      numberOfKeys: 1,
      lua: LuaScriptRegistry.ACQUIRE_LOCK,
    });
    (client as any).defineCommand('motusReleaseLock', {
      numberOfKeys: 1,
      lua: LuaScriptRegistry.RELEASE_LOCK,
    });
    (client as any).defineCommand('motusRenewLock', {
      numberOfKeys: 1,
      lua: LuaScriptRegistry.RENEW_LOCK,
    });
    (client as any).defineCommand('motusSaveDriverAtomic', {
      numberOfKeys: 3,
      lua: LuaScriptRegistry.SAVE_DRIVER_ATOMIC,
    });
    (client as any).defineCommand('motusExpireSessionScan', {
      numberOfKeys: 1,
      lua: LuaScriptRegistry.EXPIRE_SESSION_SCAN,
    });
    (client as any).defineCommand('motusPruneSessionData', {
      numberOfKeys: 3,
      lua: LuaScriptRegistry.PRUNE_SESSION_DATA,
    });
    (client as any).defineCommand('motusDriverStatusCas', {
      numberOfKeys: 1,
      lua: LuaScriptRegistry.DRIVER_STATUS_CAS,
    });
  }
}
