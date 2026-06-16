# @motus/socketio

Real-time Socket.IO transport layer for the **Motus** dispatch and tracking platform.

Provides driver presence updates, high-frequency location streaming, session subscription lifecycles, and horizontal scaling adapters.

## Installation

```bash
npm install @motus/socketio
```

## Features

- **Decoupled Transport Abstractions**: Wraps Socket.IO behind a clean `TransportAdapter` contract.
- **Extensible Authentication**: Plug in JWT, OAuth, or custom session tokens using `IAuthenticator`.
- **Multi-device Driver presence**: Tracks multiple connected devices per driver ID, automatically coordinating presence states.
- **Telemetry Optimization**: Spatial (2-meter) decimation and temporal (1Hz) throttling logic built-in to prevent network congestion.
- **Horizontal Clustering**: Scalable across multiple Socket.IO server instances using `@socket.io/redis-adapter`.
- **Fault Tolerance**: Fallback local-routing mode during Redis outages and custom disconnect grace-period timers.

## Basic Usage

```typescript
import { SocketServer } from '@motus/socketio';
import { Motus } from '@motus/core'; // core namespaces
import { RedisClientManager } from '@motus/redis';

// 1. Initialize core dependencies
const driverNamespace = new DriverNamespace(driverManager);

// 2. Define custom authenticator
const customAuthenticator = {
  async authenticate(handshake) {
    const token = handshake.token;
    if (!token) throw new Error('Unauthenticated');
    return {
      tenantId: 'tenant_abc',
      driverId: token.startsWith('driver_') ? 'driver_123' : undefined,
    };
  }
};

// 3. Instantiate SocketServer
const server = new SocketServer(
  {
    port: 8080,
    path: '/socket.io',
    connectionStateRecovery: { enabled: true }
  },
  customAuthenticator,
  driverNamespace
);

// 4. Start listening
await server.start();
```

## Documentation Guides

For in-depth guides, see the following markdown documentation files:
- [Gateway Event Schema Guide](./docs/gateways.md)
- [Pluggable Authentication Guide](./docs/authentication.md)
- [Room Design & Lifecycle](./docs/room-strategy.md)
- [Scaling & Performance Guidelines](./docs/scaling.md)
- [Redis Adapter Configuration](./docs/redis-adapter.md)
- [Troubleshooting & Failure Scenarios](./docs/troubleshooting.md)
