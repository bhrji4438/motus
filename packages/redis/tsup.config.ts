import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  shims: true,
  minify: false,
  target: 'node20',
  tsconfig: 'tsconfig.build.json',
  external: ['@motus/types', '@motus/core', 'ioredis'],
});
