# 41 - Contract Versioning Policy

This document defines the authoritative versioning policy and evolution guidelines for all public contracts of the Motus platform. It governs API routes, event schemas, payload structures, SDK interfaces, and client compatibility expectations.

---

## 1. Purpose

The Motus system relies on dynamic interaction across distributed systems. This policy provides a framework to ensure that public APIs and contract updates do not break existing tenant integrations, driver connections, or asynchronous processors.

---

## 2. Contract Evolution Principles

To keep the platform-independent interfaces stable, the following principles guide all contract modifications:
*   **Agnosticism First:** Contracts are defined as platform-independent architectural specifications. Serialization choices (JSON, Protobuf) are secondary.
*   **Explicit Intent:** All breaking changes must be declared, planned, and communicated through the official deprecation lifecycle.
*   **Graceful Degradation:** Older clients must remain operational during rollouts. The platform must handle partial or outdated payloads without catastrophic failures.

---

## 3. Semantic Versioning Strategy

Motus contracts adhere to the Semantic Versioning (SemVer) standard (`MAJOR.MINOR.PATCH`):
*   **MAJOR Version (`X.0.0`):** Upgraded when introducing changes that break backward compatibility (e.g. deleting attributes, modifying required input parameter structures, or altering state machine transition boundaries).
*   **MINOR Version (`0.Y.0`):** Upgraded when adding new backward-compatible features or properties (e.g. introducing optional fields to a request or adding new events to the event catalog).
*   **PATCH Version (`0.0.Z`):** Upgraded for backward-compatible bug fixes or documentation improvements.

---

## 4. API Evolution Rules

### HTTP REST APIs
*   **Route Versioning:** High-level API versions are mapped to URL routes (e.g., `/api/v1/sessions/...`).
*   **Content Negotiation:** Clients can requests specific contract variants by setting the standard `Accept` header:
    `Accept: application/vnd.motus.v1+json`

### WebSockets
*   **Handshake Versioning:** Clients submit their target API version during the handshake phase as query arguments. Connection requests with unsupported contract versions are rejected.

---

## 5. Event Evolution Rules

Outbound domain events are decoupled from synchronous API routes:
*   **Namespace Stability:** Event names (e.g. `session.assigned`) are permanent. Altering the spelling or terminology of a published event requires a major event version upgrade.
*   **Payload Extension:** Event consumers must ignore unrecognized attributes in JSON payload structures.
*   **Event Version Tagging:** The metadata envelope of every event must contain the version string of the schema, allowing event routers to dispatch payloads to appropriate handlers:
    ```json
    {
      "eventId": "f3b397f2-1084-482a-9293-6a0cb5dcb40f",
      "eventName": "session.assigned",
      "eventVersion": "1.2.0",
      "timestamp": "2026-06-11T13:12:00.000Z",
      "payload": { ... }
    }
    ```

---

## 6. Request/Response Evolution Rules

To maintain compatibility during updates, requests and responses follow strict compatibility guidelines:

### Safe (Non-Breaking) Changes
*   **Adding Optional Fields:** Adding optional properties to requests or new fields to response envelopes.
*   **Relaxing Constraints:** Shifting a request parameter from required to optional, or expanding value boundaries (e.g. increasing maximum search radius range).
*   **Adding New Optional Headers:** Introducing new metadata headers to API requests.

### Breaking Changes
*   **Adding Required Fields:** Adding a new mandatory parameter to a request.
*   **Tightening Constraints:** Converting an optional field to required, or narrowing validation ranges.
*   **Modifying Data Types:** Shifting a property from string to object, or modifying coordinate formats.
*   **Deleting Fields:** Deleting existing fields from response schemas.

---

## 7. Deprecation Lifecycle

When a public contract feature must be decommissioned, it must pass through the following timeline:
1.  **Announcement Phase (Minor Release `vX.Y.0`):** The feature is marked as `@deprecated` in all interfaces and API specifications. The runtime logs warnings to clients using the deprecated capability.
2.  **Maintenance Phase (Next Minor Release `vX.Y+1.0`):** The system continues to support the deprecated capability. Code examples are modified to highlight the replacement pattern.
3.  **Removal Phase (Next Major Release `vX+1.0.0`):** The deprecated feature is physically removed from schemas and codebases.

---

## 8. Compatibility Matrix

| Client SDK Version | Server API Version | Supported Event Versions | Support Status |
| :--- | :--- | :--- | :--- |
| `v1.x.x` | `/api/v1` | `v1.x.x` | Active |
| `v1.x.x` | `/api/v2` | `v2.x.x` | Unsupported (Requires Upgrade) |
| `v2.x.x` | `/api/v2` | `v2.x.x` | Active |

---

## 9. Migration Guidance

When introducing a breaking contract version upgrade (e.g. v1 to v2):
*   **Dual Ingestion Run:** The server must host both `/api/v1` and `/api/v2` routes concurrently during the migration window (minimum: 6 months).
*   **Event Translation:** The event broker should use adapters to translate newer v2 events to v1 schema formats for legacy subscribers.
*   **Client SDK Coexistence:** SDK package releases must publish migration codemods or detailed step-by-step guides to help integrators update method calls.

---

## 10. Long-Term OSS Governance Expectations

As an open-source framework, changes to Motus public contracts require strict governance:
*   **RFC Process:** Any major version change or new API capability must be proposed via a formal Request for Comments (RFC) issue.
*   **Community Input:** The RFC must remain open for community discussion for a minimum of 14 days before a pull request can be merged.
*   **Consensus Verification:** The Technical Steering Committee (TSC) must sign off on the RFC, confirming that the change adheres to the versioning and evolution policies established in this document.
