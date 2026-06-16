# @motus/testing

Testing builders, mocks, and container testbeds for the Motus platform.

---

## 1. Purpose

Provides test utilities, mock databases, and WebSocket mocks to help developers test integrations without setting up external dependencies.

---

## 2. Installation

```bash
npm install @motus/testing --save-dev
```

---

## 3. Quick Start

```typescript
import { buildDriver, createMockRedisClient } from "@motus/testing";

const mockDriver = buildDriver({ id: "D1" });
const mockRedis = createMockRedisClient();
```

---

## 4. Configuration

Provides mocks for databases and connections out of the box, requiring zero configurations.

---

## 5. Common Use Cases

- Generating mock domain entities with custom overrides.
- Running repository tests against an in-memory Redis mock.
- Mocking client websocket messages and tracking room events.

---

## 6. API Reference Link

- [API Reference: @motus/testing](../../docs/api-reference/testing.md)

---

## 7. Related Modules

- `@motus/core` — Domain models.
- `@motus/redis` — Repositories and database structures.

---

## 8. Production Notes

This package contains test double mocks. Do **NOT** import this package in production builds or configure it outside test scripts.

---

## 9. Limitations

Mocks only emulate basic core command behaviors. Execute integration tests on a real Redis instance (via Docker container) to verify cluster features.

---

## 10. Examples

Detailed builder examples can be found in the [Testing Guide](../../docs/testing.md).
