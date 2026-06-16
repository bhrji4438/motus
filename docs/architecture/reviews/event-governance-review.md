# Event Governance Review

## Current State
The existing event architecture in `10-event-architecture.md` outlines basic event definitions and mentions CloudEvents compliance. However, it lacks a formal governance structure, detailed retry policies, duplicate handling guidance, Dead Letter Queue (DLQ) designs, and event ordering rules.

---

## Findings
1.  **Duplicate Delivery Risks:** In-flight network drops during message broker acknowledgments can lead to duplicate events. Without strict deduplication rules, consumers might process the same event multiple times (e.g. charging a payment twice).
2.  **Order of Events:** Real-time states require in-order delivery. If a `session.completed` event is processed by a consumer *before* `session.driver_assigned` due to parallel message consumption, the consumer's state machine will crash.
3.  **Error Handling & DLQ:** System integrations fail. Without an backoff strategy and a Dead Letter Queue (DLQ) layout, failing events will block message streams.

---

## Risks
*   **Out-of-Order States:** Out-of-order execution in downstream consumer apps can cause billing issues or broken order flows.
*   **Infinite Loops / Poison Pills:** A corrupt event payload that fails downstream validation can cause infinite retries, blocking the event processor.

---

## Recommended Changes (Event Governance Framework)

### A. Event Ownership
*   **Motus Domain Events:** Motus owns presence, locations, matching wave changes, session state mutations, and telemetry reports.
*   **Consumer Events:** Consuming apps own bookings, invoicing, push alerts, and user accounts. Motus never directly calls pricing or payment handlers.

### B. Event Naming Convention
Every event emitted by Motus must use the pattern:
```
motus.<entity>.<action>.<version>
```
*   Example: `motus.session.state_changed.v1`
*   Example: `motus.driver.presence_updated.v1`

### C. Event Ordering & Partitioning
To guarantee in-order delivery of state changes for a given session or driver:
*   Events must be partitioned in the broker using a partition key.
*   **For Sessions:** The `sessionId` is the partition key. This guarantees that all events for a specific session (created, assigned, en route, arrived, completed) flow to the same broker partition, preserving execution order.
*   **For Drivers:** The `driverId` is the partition key.

### D. Idempotency & Duplicate Handling
*   All events contain a unique, immutable CloudEvents UUID (`id`).
*   **Consumer Rule:** Consuming services must implement an Idempotency Repository (e.g. database table of processed event IDs). Before processing an event, they must check if `id` exists. If yes, the event is skipped.

### E. DLQ & Retry Strategy
When an outbox worker fails to deliver an event or a consumer fails to process it:
1.  **Retry Backoff:** Retries are executed using exponential backoff with jitter:
    $$T_{\text{wait}} = 2^{\text{attempt}} \times 1000 \text{ ms} \pm \text{jitter}$$
2.  **Max Retries:** Retries are capped at 5 attempts.
3.  **Dead Letter Queue (DLQ) Escalation:** If all 5 attempts fail, the event is routed to `motus:events:dlq`. Operational alerts are raised, and the stream cursor moves forward to prevent blocking subsequent events.

---

## Final Decision
Adopt this formal Event Governance framework. Require all Motus outbox streams to implement partition-key ordering and enforce consumer idempotency checks as a prerequisite for V1 deployment.

---

## Impact Analysis
*   **Reliability:** Prevents processing loops and ensures that network connectivity issues do not result in out-of-order transactions or data corruption.
*   **Integration Overhead:** Increases complexity for consuming applications, as they must build idempotency checks and handle event versioning. This is an standard trade-off for distributed systems architecture.
