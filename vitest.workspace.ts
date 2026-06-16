import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/types/vitest.config.ts',
  'packages/core/vitest.config.ts',
  'packages/redis/vitest.config.ts',
  'packages/socketio/vitest.config.ts',
  'packages/testing/vitest.config.ts',
  'packages/observability/vitest.config.ts',
  'packages/notifications/vitest.config.ts',
  'packages/dashboard/vitest.config.ts',
]);

