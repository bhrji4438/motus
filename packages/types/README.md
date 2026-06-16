# @motus/types

Shared TypeScript type contracts and domain models for the Vectro platform.

---

## 1. Purpose

Defines the core data contracts, interfaces, and enums for the Vectro monorepo packages, establishing domain definitions and schema validation constraints.

---

## 2. Installation

```bash
npm install @motus/types
```

---

## 3. Quick Start

```typescript
import { Driver, SessionState } from "@motus/types";
```

---

## 4. Configuration

Exports config structures (e.g. `MatchingConfig`, `FanoutConfig`, `TelemetryConfig`) utilized by the core engine.

---

## 5. Common Use Cases

- Type-checking command and query payloads.
- Enforcing state transitions using `SessionState` enums.
- Writing mock objects that conform to platform types.

---

## 6. API Reference Link

- [API Reference: @motus/types](../../docs/api-reference/types.md)

---

## 7. Related Modules

- `@motus/core` — Domain handlers implementing these types.

---

## 8. Production Notes

This package contains only type definitions and zero execution code, compile it directly in your TypeScript configuration paths.

---

## 9. Limitations

Contains interfaces and value objects only. It has no runtime side effects or logic.

---

## 10. Examples

Detailed type and command schemas can be found in the [Types API Reference Page](../../docs/api-reference/types.md).
