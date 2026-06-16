# 21 - Linting & Quality

This document defines the static analysis configurations, formatting standards, import sorting structures, and git hooks designed to maintain code health across the Motus repository.

---

## Goals
*   **Uniform Code Style:** Enforce a single aesthetic standard throughout the workspace, preventing style debates in pull requests.
*   **Automatic Quality Checks:** Prevent common JavaScript/TypeScript pitfalls (such as float errors, unhandled promises, and unused references) using compiler-level parsing.
*   **Deterministic Import Ordering:** Enforce strict organization of modules to keep file headers clear and scannable.
*   **Pre-Commit Quality Gates:** Run validation checks on changed code before it can be committed to Git.

---

## Code Quality Workflow

Static analysis and quality controls are integrated directly into the developer workflow and CI gatekeeping:

```mermaid
flowchart LR
    DevCommit["Developer writes code\n& runs 'git commit'"] --> Husky["Husky Git Hook"]
    Husky --> LintStaged["Lint Staged\n(Runs on changed files only)"]
    
    subgraph QualityPasses [Lint Staged Commands]
        PrettierCheck["prettier --write"]
        ESLintCheck["eslint --fix"]
        TSCheck["tsc --noEmit (Selected packages)"]
    end
    
    LintStaged --> PrettierCheck
    LintStaged --> ESLintCheck
    LintStaged --> TSCheck
    
    ESLintCheck -->|Pass| CommitOK["Git Commit Successful"]
    ESLintCheck -->|Fail| CommitFail["Commit Blocked\n(Fix Lint Errors)"]
```

---

## Design Decisions

### 1. ESLint Flat Config System
Motus adopts the **ESLint Flat Config** standard (`eslint.config.js`).
*   **Workspace Declarations:** Flat configs eliminate complex legacy overrides hierarchies (`.eslintrc` in every package) in favor of a single cascading configuration file at the repository root.
*   **TS-ESLint Integration:** Employs `@typescript-eslint/parser` and `@typescript-eslint/eslint-plugin` to check TypeScript syntax, enforcing rules like:
    *   `no-floating-promises` (requires handling asynchronous outputs explicitly).
    *   `await-thenable` (prevents calling `await` on non-promise statements).
    *   `no-misused-promises` (prevents passing promises to synchronous handlers).

### 2. Prettier Formatting Separated from Linting
*   **Dedicated Formatter:** Formatting (indentation, line lengths, quotes) is delegated entirely to **Prettier**.
*   **Rule Separation:** To prevent rule overlap and performance lags, the linter and formatter are separated:
    *   Prettier is run as a separate tool in parallel.
    *   `eslint-config-prettier` is applied to ESLint to turn off all style-related rules, reserving ESLint strictly for code-quality checks.

### 3. Automated Import Sorting
To keep file imports clean and readable, the ESLint configuration includes `eslint-plugin-simple-import-sort`. Imports are grouped and sorted in the following order:
1.  Node.js built-ins (`fs`, `path`, `crypto`).
2.  External NPM dependencies (`express`, `ioredis`, `socket.io`).
3.  Internal monorepo workspace packages (`@motus/core`, `@motus/types`).
4.  Relative local file imports (`./session`, `../utils`).

### 4. Git Hooks with Husky and Lint-Staged
*   **Fast Pre-Commit Hooks:** To avoid forcing developers to run a full workspace lint pass before every commit, **Husky** hooks the Git `pre-commit` event to trigger **Lint-Staged**.
*   **Targeted Validation:** Lint-Staged runs ESLint and Prettier exclusively against the modified files staged in Git.

---

## Alternatives Considered

### 1. Biome (formerly Rome)
*   **Approach:** Use Biome as a unified compiler, formatter, and linter written in Rust.
*   **Why Rejected:** While Biome is faster than ESLint, its plugin ecosystem is not yet as mature. Advanced rules for TypeScript (like parsing type graphs across project references for custom framework rules) and community integrations are not as robust as the ESLint/TypeScript ecosystem.

### 2. Running Linting within ESLint via `eslint-plugin-prettier`
*   **Approach:** Run Prettier formatting checks as a rule within ESLint.
*   **Why Rejected:** This causes significant performance issues during large workspace lint passes, as Prettier calculations are executed through the ESLint parsing overhead. Keeping them separate runs formatting check at native speed.

---

## Tradeoffs

*   **Config Syntax Drift:** Flat configuration syntax differs from traditional legacy configs (JSON objects, glob filters, and plug-in declarations). This is accepted since flat config is the modern standard for ESLint and reduces multi-package configuration overhead.

---

## Future Considerations

*   **Custom Monorepo Bounds Lints:** Adding `eslint-plugin-import` rules to explicitly block illegal import layers (e.g., throwing a lint error if `@motus/core` attempts to import from `@motus/redis` or `@motus/server`).
*   **Strict JSDoc Rules:** Enforcing JSDoc style checks on public-facing files to ensure developer docs are automatically hydrated by the type generators.

---

## Recommended Standards

### 1. The Global `eslint.config.js` Configuration
This config is placed at the root of the workspace:
```javascript
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  prettierConfig,
  {
    languageOptions: {
      parserOptions: {
        project: [
          './tsconfig.base.json',
          './packages/*/tsconfig.json',
          './apps/*/tsconfig.json'
        ],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ],
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'eqeqeq': ['error', 'always'],
    },
  },
  {
    // Ignore build folders and locks
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**'],
  }
);
```

### 2. The `.prettierrc` Format Rules
This config is placed at the root of the workspace:
```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "semi": true,
  "bracketSpacing": true,
  "arrowParens": "always"
}
```

### 3. Naming Conventions Checklist
*   **Directories and Files:** Must use `kebab-case` (e.g. `driver-presence-repository.ts`).
*   **Classes & Interfaces:** Must use `PascalCase` (e.g. `RedisSessionRepository`). Interfaces must not use the `I` prefix (e.g. use `SessionRepository` instead of `ISessionRepository`, except when explicitly differentiating abstract contracts from implementations).
*   **Functions, Variables & Methods:** Must use `camelCase` (e.g. `calculateDistance`).
*   **Constants:** Must use `UPPER_CASE` (e.g. `EARTH_RADIUS_KM`).
