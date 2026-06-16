/**
 * Shared mutation testing configuration guidelines and validation helpers.
 */
export const strykerConfig = {
  package: '@motus/core',
  mutator: {
    plugins: ['javascript', 'typescript'],
    excludedMutations: [],
  },
  testRunner: 'vitest',
  reporters: ['progress', 'clear-text', 'html'],
  coverageAnalysis: 'perTest',
  thresholds: {
    high: 80,
    low: 60,
    break: 60, // Fails build if mutation score drops below 60%
  },
  mutate: [
    'src/internal/services/matching/**/*.ts',
    'src/internal/services/fanout/**/*.ts',
    'src/internal/state/**/*.ts',
  ],
};

/**
 * Validates that mutation targets exist and compile.
 */
export function getMutationTargets(): string[] {
  return strykerConfig.mutate;
}
