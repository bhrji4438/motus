# 18 - Package Architecture

This document defines the package classifications, governance rules, layer boundaries, dependency rules, and expansion protocols for Motus packages.

---

## Purpose
This document establishes the package architecture of the Motus monorepo, detailing the stability targets, compatibility guarantees, import rules, and dependency flows that govern software boundaries.

---

## Goals
*   **Prevent Circular Dependency Loops:** Ensure that build outputs and type linkages follow strict unidirectional pathways.
*   **Enforce Encapsulation Boundaries:** Distinguish clearly between packages intended for public distribution and those designed for internal execution.
*   **Prevent Monorepo Sprawl:** Provide a structured evaluation framework for proposing, reviewing, and creating new packages.
*   **Standardize Version Promotions:** Define the lifecycle path of packages from experimental incubations to stable releases and deprecations.

---

## Scope
This architecture governs all code packages located under `/packages` and specifies the rules for internal linking, public publishing, and dependency layering.

---

## Design Decisions

### 1. Dependency Flow Architecture

To maintain modularity and prevent circular dependencies, Motus enforces a strict unidirectional dependency graph. Lower-level packages must not import from higher-level packages.

```mermaid
flowchart TD
    subgraph ExecutionLayer [Execution & Routing Layer (Internal)]
        Server["@motus/server\n(REST Server Gateway)"]
        SocketIO["@motus/socketio\n(WebSocket Telemetry Daemon)"]
    end

    subgraph StorageLayer [Infrastructure & Storage Layer (Internal)]
        RedisPkg["@motus/redis\n(Redis State Repositories)"]
    end

    subgraph CoreDomain [Core Business Logic Layer (Public / Internal)]
        Core["@motus/core\n(Stateless Matching & State Rules)"]
    end

    subgraph FoundationLayer [Foundational Typings Layer (Public)]
        Types["@motus/types\n(TypeScript Interface Contracts)"]
    end

    %% Dependency Connections (Acyclic)
    Server --> SocketIO
    Server --> RedisPkg
    Server --> Core
    Server --> Types

    SocketIO --> RedisPkg
    SocketIO --> Core
    SocketIO --> Types

    RedisPkg --> Core
    RedisPkg --> Types

    Core --> Types
```

### 2. Package Classifications and Registry Strategy

| Package Name | Classification | Purpose & Stability Level | Compatibility Guarantees | Lifecycle / Registry |
| :--- | :--- | :--- | :--- | :--- |
| **`@motus/types`** | Public | Shared interface contracts, event envelopes, and API payloads. **Stable**. | **High:** Strict semver. Breaking changes require major version bumps. | Published to npm registry. |
| **`@motus/core`** | Public | Pure stateless business validation, matching filters, and geofencing math. **Stable**. | **High:** Strict semver. Safe for external programmatic integrations. | Published to npm registry. |
| **`@motus/redis`** | Internal | Redis storage repositories, lock managers, and streams adapters. **Stable**. | **None:** Private implementation details. Subject to change without notice. | Internal workspace consumption only. Not published. |
| **`@motus/socketio`**| Internal | Real-time WebSocket connection handling and subscription room routing. **Stable**. | **None:** Private execution engine. | Internal workspace consumption only. Not published. |
| **`@motus/server`** | Internal | HTTP endpoint routing, OpenAPI schemas generation, and system bootstrapping. **Stable**. | **None:** Private gateway runner. REST API compatibility is versioned at the HTTP level. | Published as Docker Container. NPM package is internal only. |

### 3. Package Governance Rules
*   **Breaking Changes:** Breaking changes in public packages (`@motus/types` and `@motus/core`) are restricted to major version releases, accompanied by migration guides.
*   **Backward Compatibility:** Public package updates must maintain backward compatibility for at least one minor version release.
*   **Promotion Pipeline:**
    *   **Experimental → Stable:** Requires 90%+ unit test coverage, a security audit, and approval from the Technical Lead.
    *   **Stable → Deprecated:** Triggered by deprecation notices in code docstrings, supported for at least one major release lifecycle.
    *   **Deprecated → Removed:** The package is removed from the codebase, and imports are redirected to replacement modules.

### 4. Dependency Mapping Constraints

| Source Package | Allowed Imports | Forbidden Imports | Rationale |
| :--- | :--- | :--- | :--- |
| `@motus/types` | None | All other packages | Types must remain a leaf node to prevent circular references. |
| `@motus/core` | `@motus/types` | `@motus/redis`, `@motus/socketio`, `@motus/server` | Domain logic must remain isolated from database and network engines. |
| `@motus/redis` | `@motus/core`, `@motus/types` | `@motus/socketio`, `@motus/server` | Storage adapters should not have dependencies on network frameworks. |
| `@motus/socketio`| `@motus/redis`, `@motus/core`, `@motus/types` | `@motus/server` | Sockets must manage real-time transport independently of HTTP gateways. |
| `@motus/server` | All other packages | None | Serves as the system composition root. |

---

## Alternatives Considered

### 1. Unified Monolithic Codebase (No Package Splits)
*   **Approach:** Maintain all code inside a single project folder, organizing namespaces through subdirectories instead of packages.
*   **Why Rejected:** A monolithic approach does not programmatically prevent circular imports. Developers can accidentally couple database code (Redis) to pure math filters (Core) without compiler errors, increasing refactoring complexity.
*   **OSS Maintenance Implications:** Increases the risk of circular dependencies and makes it harder for contributors to run isolated tests.

### 2. High-Granularity Package Partitioning (Micro-packages)
*   **Approach:** Create separate packages for minor utilities (e.g. `@motus/geofencing`, `@motus/matching-wave-filter`).
*   **Why Rejected:** Micro-packages lead to workspace configuration fragmentation, increasing build times and lockfile churn without providing significant separation benefits.

---

## Tradeoffs

*   **Boundary Enforcement Overhead:** Isolating modules into workspace packages requires maintaining separate `package.json` configurations and building package links. This minor overhead is accepted to ensure strict dependency isolation.

---

## Recommended Standards
1.  **Strict Layering:** Lower-level packages must not import from higher-level packages.
2.  **No Direct Imports:** Imports between workspace packages must reference the package name (e.g., `import "@motus/core"`), rather than resolving file paths directly (e.g., `import "../core/src/index"`).
3.  **Strict Dependency Declaration:** All peer dependencies and workspace dependencies must be declared in each package's `package.json`.

---

## Risks
*   **API Boundary Leaks:** Developers might accidentally export internal interfaces through `@motus/types`, exposing them to external consumers. This risk is addressed by code reviews that check the public API surface area.
*   **Acyclic Resolution Failures:** A circular dependency can break package compilation and tooling. This is mitigated by CI checks that validate the package import graph.

---

## Future Expansion Strategy
To prevent monorepo sprawl, new packages must undergo a formal evaluation process.
*   **New Package Proposals:** Proposals for new packages (e.g. `@motus/matching-engine`, `@motus/testing-mocks`) must be submitted as RFCs (Requests for Comments).
*   **Evaluation Criteria:** Proponents must demonstrate that the code:
    1.  Will be reused across multiple consumer entrypoints.
    2.  Requires independent versioning separate from existing packages.
    3.  Does not introduce circular dependencies into the package graph.
