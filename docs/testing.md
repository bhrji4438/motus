# Testing Guide - Vectro Platform

This document describes how to execute unit, integration, and performance tests, configure testing tools, and utilize the `@motus/testing` utilities.

---

## 1. Running the Test Suites

We use `vitest` for fast, asynchronous test executions across the monorepo.

### Run Unit Tests

Unit tests run on mocked structures and do not require external dependencies:

```bash
npm run test
```

### Run Integration Tests

Integration tests verify Redis connections and Pub/Sub mechanics using Docker container testbeds:

```bash
# Ensure Docker daemon is running
npm run build
npx vitest run --includes "**/integration/**"
```

### Type Checking & Quality

```bash
# Run ESLint validation
npm run lint

# Run TypeScript compilation check
npm run typecheck
```

---

## 2. Using `@motus/testing` Mocks & Builders

The `@motus/testing` package provides reusable builders, mock databases, and sockets.

### A. Object Builders

Avoid writing raw fixtures. Use fluent builders to generate valid model contracts:

```typescript
import { buildDriver, buildSession, buildLocation } from "@motus/testing";

// Generate a mock driver entity
const driver = buildDriver({
  id: "driver-123",
  capacity: 2,
  vehicleType: "SUV",
});

// Generate a mock coordinate
const location = buildLocation({
  latitude: 40.7128,
  longitude: -74.006,
});
```

### B. Redis Integration Mocks

Run repositories against a localized in-memory Mock Redis database:

```typescript
import { createMockRedisClient } from "@motus/testing";
import { RedisDriverRepository } from "@motus/redis";

const mockRedis = createMockRedisClient();
const repository = new RedisDriverRepository(mockRedis);
```

### C. Socket Gateway Testing

The testbed features mock socket clients and mock connection handlers:

```typescript
import { createMockSocketConnection } from "@motus/testing";

const mockSocket = createMockSocketConnection();
mockSocket.on("tracking_broadcast", (data) => {
  console.log("Received telemetry broadcast:", data);
});
```

---

## 3. Mutation Testing with Stryker

To verify test suite coverage strength, run Stryker mutation tests:

```bash
npx stryker run
```

This inserts minor changes (mutations) into source code to ensure that unit tests fail when code logic changes, guaranteeing code coverage reliability.
