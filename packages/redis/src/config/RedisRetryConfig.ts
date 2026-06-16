/**
 * Controls reconnect and per-command retry behaviour.
 */
export interface RedisRetryConfig {
  /** Max reconnect attempts. 0 = infinite. @default 0 */
  maxReconnectAttempts: number;
  /** Base delay between reconnect attempts in ms. @default 100 */
  reconnectBaseDelayMs: number;
  /** Maximum reconnect delay cap in ms. Caps exponential backoff. @default 3000 */
  reconnectMaxDelayMs: number;
  /** Max retries ioredis makes per individual failed command. @default 3 */
  maxRetriesPerRequest: number;
}

/** Default retry config. */
export const DEFAULT_RETRY_CONFIG: RedisRetryConfig = {
  maxReconnectAttempts: 0,
  reconnectBaseDelayMs: 100,
  reconnectMaxDelayMs: 3000,
  maxRetriesPerRequest: 3,
};
