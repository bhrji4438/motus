# 40 - API Consistency Review

This document presents a comprehensive review of the public contract layer for the Motus engine. It cross-references all SDK signatures, domain entities, event catalogs, serialization strategies, and error systems to guarantee uniformity, multi-tenant isolation, and a premium developer experience.

---

## Consistency Verification Matrices

### 1. Naming & Parameter Consistency
*   **Rule:** Property names must use camelCase. Resource identifiers must use type-prefixed strings (`tnt_`, `drv_`, `ses_`). Coordinates are represented consistently across all payloads.
*   **Audit Results:**
    *   `RegisterTenantRequest` (Input) $\rightarrow$ `TenantResponse` (Output) $\rightarrow$ `Tenant` (Domain Model). Property naming is aligned (e.g. `matchingStrategy`, `waveTimeoutSeconds` are consistent across inputs, outputs, and the internal entity).
    *   `RegisterDriverRequest` (Input) $\rightarrow$ `DriverResponse` (Output) $\rightarrow$ `Driver` (Domain Model). Driver parameters (`capacity`, `vehicleType`) map consistently.
    *   `CreateSessionRequest` (Input) $\rightarrow$ `SessionResponse` (Output) $\rightarrow$ `Session` (Domain Model). Route origin/destination parameters use matching coordinates structures.

### 2. Identifier Alignment
*   **Rule:** Prefix constraints must match exactly across all validation rules, value objects, and serialization models.
*   **Audit Results:**
    *   Tenant IDs consistently conform to `tnt_` format.
    *   Driver IDs consistently conform to `drv_` format.
    *   Session IDs consistently conform to `ses_` format.
    *   Event IDs consistently conform to standard prefixless UUIDv4.

### 3. State Machine & Event Invariant Correlation
*   **Rule:** State machine status changes must trigger corresponding events named according to the namespace catalog.
*   **Audit Results:**
    *   Driver Presence states (`ONLINE`, `OFFLINE`, `PAUSED`, `STALE`, `BUSY`) map directly to events `driver.online`, `driver.offline`, and `driver.paused`.
    *   Session states (`CREATED`, `SEARCHING`, `DRIVER_ASSIGNED`, `DRIVER_EN_ROUTE`, `ARRIVED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `DRIVER_LOST`) map directly to events `session.created`, `session.searching`, `session.assigned`, `session.arrived`, `session.started`, `session.completed`, `session.cancelled`, and `session.driver_lost`.
    *   Wave states (`ACTIVE`, `COMPLETED`, `EXPIRED`) map directly to events `dispatch.wave.started`, `dispatch.wave.completed`, and `dispatch.no_driver_found`.

### 4. Error Code & Exception Mapping
*   **Rule:** Error occurrences during transitions must return consistent error structures and correct status codes.
*   **Audit Results:**
    *   Invalid state machine transitions consistently return `MOTUS_INVALID_TRANSITION` (`422 Unprocessable Entity`).
    *   Resource locking conflicts return `MOTUS_LOCK_ACQUISITION_FAILED` (`409 Conflict`).
    *   Resource misses throw `MOTUS_DRIVER_NOT_FOUND` or `MOTUS_SESSION_NOT_FOUND` (`404 Not Found`).

### 5. Multi-Tenant Boundaries
*   **Rule:** Every mutating command and query must isolate access boundaries, enforcing tenant context check checks on reference items.
*   **Audit Results:**
    *   Tenant verification JWT headers map to the payload tenant attributes.
    *   Cross-tenant modifications return clean not found errors to prevent entity sharding sniffing attacks.

---

## SDK Ergonomics & Developer Experience (DX)

The Motus SDK is designed to be developer-friendly:
1.  **Logical Namespaces:** Grouping APIs into `tenant`, `driver`, `session`, `query`, and `events` prevents namespace pollution, making code completion intuitive for developers.
2.  **Explicit Typings:** Language-agnostic contracts map directly to strict TypeScript typings, providing clear auto-complete support in code editors.
3.  **Predictable Error Handling:** The standard error structure ensures developers can write predictable try-catch blocks:
    ```typescript
    try {
      await sdk.session.completeSession({ tenantId: "tnt_1", sessionId: "ses_1" });
    } catch (error) {
      if (error.code === 'MOTUS_INVALID_TRANSITION') {
        console.error('Session was in an invalid state for completion:', error.message);
      }
    }
    ```
4.  **Flexible Event Listening:** The `events` namespace provides standard event-emitter capabilities, supporting wildcards for broad subscriptions (e.g. `sdk.events.on('session.*', handler)`).

---

## Versioning Considerations

### Versioning Policy for Consistency Review
*   **Consistency Maintenance:** The API consistency standards detailed here must be validated during each release cycle.
*   **Breaking Alignments:** If a property name is identified as inconsistent (e.g., camelCase vs snake_case mismatches) in a published version, fixing it is a breaking change. The change must be rolled out by deprecating the old key and keeping it active for one major release cycle.
*   **Tooling Rules:** Automated tooling (such as markdown validators, contract verification suites, and linter rules) must be updated to enforce these naming and structural standards.
