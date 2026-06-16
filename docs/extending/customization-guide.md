# Platform Customization Guide

This document describes how to customize dynamic parameters, override matching strategies, hook into state machines, and configure custom log filters.

---

## 1. Custom Matching Strategy

By default, Vectro ranks candidate drivers using straight-line distance calculations (`HAVERSINE`). You can register custom strategies (e.g. ETA routing calculations using OSRM, Valhalla, or Google Maps).

To write a custom matching strategy:

1.  Implement the `IMatchingStrategy` port interface.
2.  Register it inside the `MatchingEngine`.

```typescript
import { IMatchingStrategy, Driver, Coordinate } from "@motus/core";

export class TrafficAwareMatchingStrategy implements IMatchingStrategy {
  public async rankCandidates(
    pickup: Coordinate,
    candidates: Driver[]
  ): Promise<Driver[]> {
    // 1. Fetch real-time traffic durations from external API
    // 2. Sort candidates based on lowest ETA
    return sortedCandidates;
  }
}
```

---

## 2. Dynamic Configuration Overrides

You can configure tenant-specific parameter overrides. Implement the `IConfigurationProvider` interface to resolve overrides dynamically:

```typescript
import { IConfigurationProvider, TenantId } from "@motus/core";

export class DatabaseConfigurationProvider implements IConfigurationProvider {
  public async getTenantOverride(
    tenantId: TenantId,
    key: string
  ): Promise<any> {
    // Query tenant settings from PostgreSQL or DynamoDB
    const setting = await db.query(
      "SELECT value FROM settings WHERE tenant_id = $1 AND key = $2",
      [tenantId, key]
    );
    return setting ? setting.value : null;
  }
}
```

Available Override Keys:

- `matching.defaultStrategy` — Strategy selection.
- `matching.initialRadiusMeters` — Initial search radius.
- `matching.maxRadiusMeters` — Maximum search boundary limit.
- `fanout.waveSize` — Wave candidate count.
- `fanout.waveTimeoutSeconds` — Timeout duration.
- `telemetry.sampleDistanceMeters` — Ingestion filtering distance.
- `telemetry.sampleIntervalSeconds` — Ingestion filtering timing.

---

## 3. State Machine Interceptors

You can run custom code (e.g. sending webhooks, creating database records, or updating metrics) whenever a session state machine transitions.

Hook custom listeners into the `StateMachineManager` in `@motus/core`:

```typescript
import { StateMachineManager } from "@motus/core";

const stateManager = new StateMachineManager();

// Register hooks
stateManager.onTransition(async (transition) => {
  console.log(
    `Session ${transition.sessionId} moved from ${transition.from} to ${transition.to}`
  );

  if (transition.to === "IN_PROGRESS") {
    await sendTripStartedWebhook(transition.sessionId);
  }
});
```

---

## 4. Customizing Observability & Logs

The `@motus/observability` package features log filtering controls. You can set the log level using standard environment variables:

```env
LOG_LEVEL=warn
```

To redirect logs to external collection systems (such as Datadog or ELK Stack), register a custom transport stream within the `Logger` configuration during initialization:

```typescript
import { Logger } from "@motus/observability";
import pinotPromise from "pino-elasticsearch";

const esStream = pinotPromise({
  node: "http://localhost:9200",
  index: "vectro-logs",
});

const appLogger = new Logger({
  stream: esStream,
});
```
