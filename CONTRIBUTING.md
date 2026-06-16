# Contributing to Vectro

We welcome contributions from the community! This document outlines the guidelines for setting up your development environment, testing code changes, checking code quality, and submitting pull requests.

---

## 1. Local Development Setup

To set up a local development workspace:

### Prerequisites

- **Node.js**: v18.0.0 or higher is required.
- **Docker**: Required for running integration tests against Redis and testing cluster configurations.

### Installation Steps

1.  Clone the repository and install all dependencies:
    ```bash
    git clone https://github.com/bhrji4438/motus.git
    cd motus
    npm install
    ```
2.  Build all workspace packages in the monorepo:
    ```bash
    npm run build
    ```

---

## 2. Monorepo Package Structure

Vectro is structured as a monorepo containing several internal packages:

- `packages/types/` — Global domain interfaces and types.
- `packages/core/` — Domain engines, state machines, and workers.
- `packages/redis/` — Storage repositories and serializations.
- `packages/socketio/` — WebSocket gateway and session recovery.
- `packages/notifications/` — Push notifications providers and managers.
- `packages/observability/` — Telemetry tracing, metrics registries, and logger.
- `packages/testing/` — Reusable mocks and integration builders.
- `packages/dashboard/` — Admin REST/SSE API and React dashboard UI.
- `packages/sdk/` — Public SDK facade package `vectro`.

---

## 3. Code Verification (Testing & Quality)

Always verify your changes compile and pass quality gates before committing.

### Run Unit Tests

Unit tests use `vitest` and do not require Docker:

```bash
npm run test
```

_Note: To run tests continuously during development, use `npm run test:watch`._

### Run Linting and Formatting

Ensure code adheres to the styling standards:

```bash
# Verify formatting
npm run format:check

# Auto-format files
npm run format

# Run ESLint validation
npm run lint
```

### Type Checking

Ensure all TypeScript definitions compile:

```bash
npm run typecheck
```

---

## 4. Release Engineering & Changesets

We use **Changesets** to automate package versioning, changelog updates, and publications. Any PR modifying files within `packages/` must include a changeset file.

### How to Create a Changeset

1.  Run the changeset CLI from the repository root:
    ```bash
    npx changeset
    ```
2.  **Select Packages**: Use arrow keys and the spacebar to select which packages are impacted by your change.
3.  **Determine SemVer Type**: Choose the type of version bump:
    - `major` — Breaking changes.
    - `minor` — New features (non-breaking).
    - `patch` — Bug fixes, refactoring, and internal modifications.
4.  **Enter Description**: Provide a brief, human-readable summary of the changes. This summary will populate the packages' local `CHANGELOG.md` files.

### Verifying Package Manifests

Before publishing or merging, verify package structures, schemas, exports, and matching dependency ranges:

```bash
npm run release:check
```

To run a dry-run local packaging simulation:

```bash
npm run release:publish
```

---

## 5. Pull Request Guidelines

1.  Create a feature branch from `main` (e.g., `feature/add-matching-strategy` or `bugfix/stale-presence-timeout`).
2.  Write tests for any new logic or bug fixes.
3.  Ensure `npm run format`, `npm run lint`, `npm run typecheck`, and `npm run test` pass successfully.
4.  Add a changeset file if editing workspace code.
5.  Open a PR targeting the `main` branch. Provide a clear description of the problem solved and links to any related issues.
