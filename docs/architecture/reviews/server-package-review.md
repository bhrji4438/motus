# Server Package Review

## Current State
The package boundaries document (`03-package-boundaries.md`) lists `@motus/server` as a core package in the monorepo, responsible for serving REST endpoints, Swagger/OpenAPI specifications, and Prometheus metrics.

---

## Findings

We evaluate two deployment and packaging models for the project:

### Option A: Dedicated `@motus/server` First-Class Package
*   **Description:** The monorepo provides a production-ready HTTP and WebSocket server wrapper.
*   **OSS Usability:** Very high. Developers can spin up the entire Motus engine using a single Docker image or command line runner (`npm run start` inside `@motus/server`).
*   **DX:** Out-of-the-box support for metrics, OpenAPI specs, and health probes, reducing development time.
*   **Maintenance:** Changes to core schemas or dependencies are compiled and verified inside the server package automatically during CI builds.

### Option B: Core SDK Framework + Example Server Boilerplate
*   **Description:** Motus is distributed as a library. Developers must write their own HTTP/Socket server wrapper using `@motus/core` and `@motus/redis`.
*   **OSS Usability:** Low. Introduces setup friction for engineers who want a ready-to-run microservice.
*   **DX:** High integration flexibility, but requires copying and maintaining boilerplate code across different deployments.

---

## Risks
*   **Adoption Bottleneck:** If Motus is distributed only as a library (Option B), adoption will drop due to setup overhead.
*   **Feature Bloat:** Keeping `@motus/server` as a first-class package introduces a risk of "feature leakage" where consumer-specific business APIs (like order routing or payment callbacks) are mistakenly added to the server package.

---

## Recommended Changes & Design Safeguards

To prevent feature leakage while maintaining usability:
1.  **Strict Boundary Separation:** `@motus/server` is restricted to orchestrating the public REST/WebSocket APIs defined in the SDK interface. It cannot contain consumer business logic (such as calculating fares or verifying user identities).
2.  **Configuration-Driven Ingestion:** All features (matching strategies, port binds, routing configurations) are controlled via environment variables or JSON configuration profiles loaded on startup.
3.  **Modular Dependency Injection:** Core components are initialized in `@motus/server` by injecting database adapters (`@motus/redis`) and connection drivers (`@motus/socketio`) dynamically.

---

## Final Decision
Retain `@motus/server` as a first-class, production-ready package in the monorepo workspace.

---

## Impact Analysis
*   **Deployment:** Enables containerized deployments (Docker/Kubernetes) of Motus out of the box, matching standard cloud microservice patterns.
*   **Maintenance:** Isolates framework testing. Changes to `@motus/core` can be verified by running integration tests directly against `@motus/server` endpoints.
