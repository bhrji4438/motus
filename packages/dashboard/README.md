# @motus/dashboard

Operational control room, system health monitoring, and sessions analysis console package for Motus.

## Features

- **6-Tier Role-Based Access Control (RBAC)**: Secure routes matching users to specific roles (`Super Admin`, `Admin`, `Dispatcher`, `Support`, `Analyst`, `Viewer`).
- **Distributed Trace Waterfall Visualizer**: Reusable client widget mapping OpenTelemetry span records into timing waterfall bars.
- **Dedicated Operational APIs**: Retrieve system analytics, session histories, driver presence location, notifications logs, and queue backlog stats.
- **SSE & WebSocket Real-time updates**: Stream telemetry coordinates using a unified transport channel with automatic fallbacks.
- **Custom Visual Map**: Lightweight HTML5 Canvas component plotting pickups, destinations, and active path lines.
- **CSV Reports Generation**: Export structured audit log reports directly to CSV.
- **Glassmorphic UI Design**: Premium UI styled with Vanilla CSS, featuring responsive grids and fluid animations.

## Structure

- `src/api/`: Backend controller layers for analytics, audits, sessions, and queues.
- `src/auth/`: RbacGuard enforcing tenant and route access boundaries.
- `src/realtime/`: Real-time Server-Sent Events (SSE) and WebSocket brokers.
- `src/ui/`: Client React SPA built and optimized using Vite.

## Setup

### 1. Register Fastify Server Plugin
```typescript
import fastify from 'fastify';
import { dashboardPlugin } from '@motus/dashboard';

const app = fastify();
await app.register(dashboardPlugin);
await app.listen({ port: 4000 });
```

### 2. Client Telemetry Connection
```typescript
import { RealtimeClient } from '@motus/dashboard/ui';

const client = new RealtimeClient('tenant-1');
client.on('driver.moved', (data) => {
  console.log('Driver moved to:', data.location);
});
client.connect();
```
