# Vectro Migration Guide: Motus to Vectro

This document guides you through upgrading your codebase from the legacy **Motus** platform to the new **Vectro** platform.

---

## 1. Package Installation & Imports

### Legacy Installation
Previously, using Motus in your backend required installing individual internal packages:

```bash
npm install @motus/core @motus/redis ioredis
```

And manually wiring the repository instances and clock:

```typescript
import { Motus } from "@motus/core";
import { RedisClientManager, RedisDriverRepository, ... } from "@motus/redis";

const clientManager = new RedisClientManager(redisClient);
const driverRepo = new RedisDriverRepository(clientManager);
// ... manual dependency injection ...
const motusClient = new Motus(tenantRepo, driverRepo, sessionRepo, clock);
```

### Upgraded Installation
Vectro consolidates the transport and core packages into a single public SDK facade:

```bash
npm install vectro
```

Initialize Vectro in a single step using `createVectro`:

```typescript
import { createVectro, MatchingStrategy } from "vectro";

const vectro = await createVectro({
  redis: {
    host: "localhost",
    port: 6379
  },
  socketio: {
    port: 3000
  }
});

// All namespaces are exposed directly under the client
await vectro.tenant.registerTenant(...);
```

All types, enums, command definitions, and facades are exported directly from the public `"vectro"` import path.

---

## 2. Redis Key Namespace Configuration (Zero-Downtime Rollouts)

To prevent breaking existing databases in production, Vectro introduces a configurable Redis key prefix.

### Key Differences
- **Legacy Prefix**: `motus:` (e.g. `motus:sessions:expiry`, `motus:tenantId:events:driver.online`).
- **Vectro Prefix (Default)**: `vectro:` (e.g. `vectro:sessions:expiry`, `vectro:tenantId:events:driver.online`).

### Upgrading Legacy Deployments
If you have a production Redis cluster with active sessions, you should configure Vectro to continue using the legacy `"motus"` prefix. This allows you to upgrade your application servers with zero data loss or downtime:

```typescript
const vectro = await createVectro({
  redis: {
    host: "localhost",
    port: 6379,
    keyPrefix: "motus" // <-- Retains legacy prefix mapping
  }
});
```

For clean, new installations, do not specify `keyPrefix`, and it will default to `"vectro"`.

---

## 3. WebSocket Namespaces and Gateway

The Socket.IO realtime server has been fully migrated to use the rebranded namespaces:

- Legacy connection path: `https://api.motus-platform.org/sessions`
- Upgraded connection path: `https://api.vectro-platform.org/sessions`

Make sure to update client-side WebSocket connections.

---

## 4. Documentation Paths

All markdown files and module paths have been renamed to target Vectro.

| Legacy Document | Upgraded Document |
| :--- | :--- |
| `docs/getting-started.md` | Refactored to focus on `createVectro()` |
| `README.md` | Redesigned landing page & portal |
| Internal code imports | Exposed via `vectro` root |

For a complete overview of the new platform, check the [README.md](README.md) portal.
