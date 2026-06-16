# 16 - Repository Structure

This document designs the physical layout of the Motus monorepo, defining directory structures, folder responsibilities, ownership boundaries, and developer submission rules.

---

## Purpose
This document establishes a standard structure for the Motus workspace. It serves as a guide for codebase organization, directory boundaries, configuration locations, and developer workflows.

---

## Goals
*   **Enforce Separation of Concerns:** Isolate reusable libraries from application entrypoints, developer documentation, and utility scripts.
*   **Facilitate Contributor Onboarding:** Ensure that new open-source contributors can locate code, tests, examples, and rules.
*   **Minimize Configuration Duplication:** Centralize build, lint, and type configurations, allowing packages to extend shared baselines.
*   **Optimize Task Execution Caching:** Design a structure that allows tools (such as Turborepo or Nx) to isolate and cache tasks, avoiding redundant test runs.

---

## Scope
This document covers the physical directory structure of the core Motus repository, including:
*   Standard root-level folders.
*   Package boundaries and organization.
*   The location of configuration templates, build scripts, examples, and documentation.
*   Directory ownership definitions and guidelines for introducing new folders.

---

## Design Decisions

### 1. Repository Layout Tree

```
motus/
├── .github/                 # GitHub repository workflows and templates
│   ├── ISSUE_TEMPLATE/      # Bug, feature, and custom request templates
│   ├── workflows/           # CI/CD pipeline scripts (lint, test, build, release)
│   └── pull_request_template.md
├── apps/                    # Deployable application endpoints and services
│   └── tracker-cli/         # Operational developer terminal console for monitoring
├── packages/                # Reusable workspace libraries and modules
│   ├── core/                # @motus/core - Pure domain state machines & filters
│   ├── redis/               # @motus/redis - Redis adapter & active state storage
│   ├── server/              # @motus/server - HTTP API gateway and server runtimes
│   ├── socketio/            # @motus/socketio - Socket.io live socket servers
│   └── types/               # @motus/types - Central TS interface & types contracts
├── examples/                # Example applications demonstrating integration patterns
│   ├── basic-dispatch/      # Basic Express API + @motus/core integration sample
│   └── react-tracking/      # Simple React tracking dashboard using Socket.io
├── docs/                    # Architectural specs, product guides, and user manuals
│   ├── architecture/        # High-level technical designs & system blueprints
│   ├── product/             # Functional specifications and domains
│   ├── guides/              # Step-by-step developer tutorials
│   └── reference/           # Raw generated SDK structures & API definitions
├── tools/                   # Shared workspace configuration directories
│   ├── eslint/              # Common ESLint configs and plugin configurations
│   ├── tsconfig/            # Shared base tsconfig files
│   └── vitest/              # Core Vitest execution templates
├── scripts/                 # Utility scripts for bootstrapping and workspace tasks
│   ├── clean-deps.js        # Script to wipe all local node_modules folders
│   └── bootstrap-redis.sh   # docker-compose setup helpers
├── benchmarks/              # Performance profiling and execution benchmarks
│   ├── matching/            # Matching pipeline throughput calculations
│   └── telemetry/           # Location data serialization measurements
├── test/                    # Global repository integration and E2E test suites
│   └── multi-tenant-e2e/    # Multi-client tenant scenario testing
├── package.json             # Root monorepo workspace configurations
├── pnpm-workspace.yaml      # Monorepo directory bounds
├── pnpm-lock.yaml           # Global dependency locks
└── turbo.json               # Fast pipeline cache configuration
```

### 2. Directory Ownership and Responsibilities

| Directory | Primary Owner | OSS Contributor Responsibility | Modification Limits |
| :--- | :--- | :--- | :--- |
| `packages/` | Technical Lead | Write unit tests alongside code changes. Keep libraries decoupled. | Changes require a changeset documentation file. |
| `apps/` | Core Maintainers | Verify compilation against core package updates. | Minor updates only. |
| `examples/` | DevRel / Community | Ensure dependencies are pinned to workspace versions. | High contribution freedom. |
| `docs/` | Docs Lead / Architects | Follow Markdown and relative link validation rules. | Requires review from maintainers. |
| `tools/` | Platform / DevOps | Keep configs clean and avoid custom variations. | Restricted to core platform maintainers. |
| `scripts/` | Platform / DevOps | Ensure scripts are cross-platform (Windows & POSIX compatible). | Allowed if improving local DX. |
| `benchmarks/` | Performance Lead | Run benchmarks to verify no performance regressions. | Encouraged for matching changes. |
| `test/` | QA / Core Maintainers | Add cross-package integrations to verify fixes. | Required for large core refactors. |

---

## Alternatives Considered

### 1. Multi-Repository Model (Split Repositories)
*   **Approach:** Maintain `@motus/core`, `@motus/redis`, and downstream packages in separate Git repositories.
*   **Why Rejected:** Multi-repo setups introduce significant friction during early development. A simple change to an interface in `@motus/types` would require pushing changes, publishing an update to npm, and pulling dependencies across multiple repositories. A monorepo strategy allows atomic changes that span packages in a single pull request.
*   **OSS Maintenance Implications:** Split repositories increase the burden of issue tracking, pull request management, and releases across multiple repositories.

### 2. Flat Directory Structure (No `packages/` Nesting)
*   **Approach:** Place all packages directly in the repository root folder.
*   **Why Rejected:** As the repository grows (e.g. adding Kafka adapters, AWS location trackers, client SDKs), the root folder becomes cluttered, and build tools cannot easily isolate linting, compilation, or testing boundaries.
*   **OSS Maintenance Implications:** Lacks clear folders structure, making it harder for contributors to identify the entry points of libraries versus configurations.

---

## Tradeoffs

*   **Setup Complexity:** Standardizing a monorepo workspace configuration (such as base `tsconfig`, ESLint path bindings, and package linkages) is more complex than maintaining a single standard project. This is accepted in exchange for strict separation of concerns and prevention of circular dependencies.
*   **Tooling Overhead:** Managing dependency lockfiles across a monorepo requires standardizing on a single workspace tool (`pnpm`), preventing developers from using standard `npm install` workflows within individual directories.

---

## Recommended Standards
1.  **Directory Casing:** All directories must use `kebab-case` (all lowercase, hyphen-separated).
2.  **No Direct Root Configurations:** Packages in `packages/` must extend configs from `tools/` and must not declare custom compilers or formatting engines.
3.  **Cross-Directory Rules:** Source code must not import across package folders directly using relative paths (e.g., `import "../../core"` is forbidden). Imports must resolve through the package manager using the workspace name (e.g., `import "@motus/core"`).

---

## Risks
*   **Workspace Dependency Bloat:** A developer might accidentally add large dependencies to the root `package.json`, causing all packages to download those libraries. This is mitigated by CI checks that block root-level additions.
*   **Path Reference Breakages:** Relocating folders can break relative pathways in documentation and configuration extensions. Relocations must be accompanied by tool validation checks.

---

## Future Considerations
*   **Polyglot Directories:** If client SDKs in other languages (such as Java, Go, or Swift) are introduced, they will be organized under a `clients/` folder (e.g., `clients/java/`), leaving `packages/` dedicated to Node.js backend modules.
*   **Remote Cache Store:** Utilizing Turborepo's remote build caches to share compile and test artifacts across developer systems and CI runners, reducing repeat runtimes.
