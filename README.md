# Motus Monorepo

Motus is a production-grade, real-time dispatch and tracking platform. This repository is structured as a monorepo containing multiple packages responsible for core domain logic, transport layers, database caching, and testing.

## Workspace Structure

The monorepo contains the following workspace packages:
*   [@motus/types](file:///c:/Mohit/Projects/motus/packages/types) - Shared API contracts, interfaces, and domain value-object validators.
*   [@motus/core](file:///c:/Mohit/Projects/motus/packages/core) - Core domain logic dispatcher, matching engine, workers, and telemetry services.
*   [@motus/redis](file:///c:/Mohit/Projects/motus/packages/redis) - Redis caching, persistence, event queues, and concurrency lock managers.
*   [@motus/socketio](file:///c:/Mohit/Projects/motus/packages/socketio) - Socket.IO real-time communication server, presence router, and session recovery registry.
*   [@motus/testing](file:///c:/Mohit/Projects/motus/packages/testing) - Reusable test doubles, test containers, and shared test suites.

---

## Local Development Scripts

Manage the monorepo from the root directory using the following npm scripts:

### Installation
Install dependencies for all workspace packages:
```bash
npm install
```

### Building
Build all packages in the monorepo:
```bash
npm run build
```

### Running Tests
Run all unit tests in the monorepo:
```bash
npm run test
```
*Note: To exclude Docker-dependent integration tests locally when a container runtime is unavailable, run `npx vitest run --exclude "**/integration/**"`.*

### Code Quality (Linting & Formatting)
Lint files:
```bash
npm run lint
```

Verify formatting:
```bash
npm run format:check
```

Fix formatting issues:
```bash
npm run format
```

---

## Release Engineering & Versioning

We utilize **Changesets** for managing package versioning, changelog updates, and publications.

- To record a version change, run `npx changeset` and select the affected packages.
- Detailed release procedures, automation workflows, rollback plans, and troubleshooting details can be found in [RELEASE.md](file:///c:/Mohit/Projects/motus/RELEASE.md).
- To audit publishing manifests and build artifacts, run `npm run release:check`.
