# How to Add a New Business Module

This guide describes how to add a new business module to the core engine and expose it through the public namespaces.

---

## Step 1: Define the Domain and Contracts

Under `@motus/types`, add the necessary interfaces, enums, command schemas, and result models.

Example: Add a Capacity Billing type in `packages/types/src/domain/billing.ts`:

```typescript
export interface BillingRecord {
  billingId: string;
  tenantId: string;
  sessionId: string;
  amount: number;
  currency: string;
}
```

Re-export this file from `packages/types/src/index.ts`.

---

## Step 2: Implement the Core Business Logic

Create the internal manager or service within `packages/core/src/internal/`:

1.  **Manager Class**: Write the implementation (e.g. `BillingManager.ts`) containing the business logic and database repository interactions.
2.  **Unit Tests**: Create a corresponding test file (e.g. `billing.test.ts`) inside the same directory to verify behavior.

---

## Step 3: Create the Public Namespace Facade

Expose the new manager through a public namespace class in `packages/core/src/public/`:

```typescript
// packages/core/src/public/BillingNamespace.ts
import { BillingRecord, TenantId, SessionId } from "@motus/types";
import { BillingManager } from "@/internal/managers/BillingManager.js";

export class BillingNamespace {
  constructor(private readonly billingMgr: BillingManager) {}

  public async getBillingRecord(
    tenantId: TenantId,
    sessionId: SessionId
  ): Promise<BillingRecord> {
    return await this.billingMgr.getRecord(tenantId, sessionId);
  }
}
```

---

## Step 4: Register Namespace in Client Facade

Update the main engine facade (`Motus` class in `packages/core/src/public/Motus.ts`):

1.  Import your new namespace.
2.  Add a public readonly property (e.g. `public readonly billing: BillingNamespace`).
3.  Instantiate it within the constructor and assign dependencies.

Expose the namespace in the public `VectroInstance` facade interface returned by `createVectro` inside `packages/sdk/src/factory.ts`.

---

## Step 5: Export from Package Index

Export the namespace facade from `packages/core/src/index.ts` and re-export it in `packages/sdk/src/index.ts`:

```typescript
export { BillingNamespace } from "@/public/BillingNamespace.js";
```

Ensure that you build the workspace and test type checking:

```bash
npm run typecheck
npm run build
```

Your module is now ready for use by consuming applications!
