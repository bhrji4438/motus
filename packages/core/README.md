# @motus/core

Core business engine and domain handlers for the Vectro platform.

---

## 1. Purpose

This package houses the business logic, state machines, matching/fanout routing systems, and background workers that coordinate the Vectro system. It acts as a pure domain codebase, keeping network framework dependencies decoupled using clean ports interfaces.

---

## 2. Installation

```bash
npm install @motus/core
```

---

## 3. Quick Start

```typescript
import { Motus } from "@motus/core";
import { SystemClock } from "./clock";

// Initialize Vectro engine instance with injected managers
const motus = new Motus(tenantMgr, driverMgr, sessionMgr, new SystemClock());
```

---

## 4. Configuration

Configuration parameters default to global settings, which can be overridden at the tenant level. Configurations are validated dynamically using validator utility checks. See the [Configuration Manager API](../../docs/api-reference/core.md#7-class-configurationmanager).

---

## 5. Common Use Cases

- Initializing dispatch sessions.
- Updating driver location updates.
- Enforcing trip transit state machines.
- Subscribing to wildcard system events (e.g. `session.*`).

---

## 6. API Reference Link

- [API Reference: @motus/core](../../docs/api-reference/core.md)

---

## 7. Related Modules

- `@motus/types` — Bounded context types.
- `@motus/redis` — Repositories and adapters implementation.

---

## 8. Production Notes

Ensure background workers (e.g. `DriverStaleDetector`, `DriverLostMonitor`) are executed in separate node processes or clusters in production.

---

## 9. Limitations

Does not maintain network connections (e.g., websockets) or persistent databases natively; all network and DB integrations require injecting adapters.

---

## 10. Examples

Detailed examples for setting drivers online and managing wave acceptances can be found in the [Getting Started Guide](../../docs/getting-started.md).
