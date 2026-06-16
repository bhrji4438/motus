# API Reference - @motus/socketio

This document details the classes, configurations, and adapter contracts of the `@motus/socketio` package.

---

## 1. Class: SocketServer

Configures, secures, and executes the Socket.IO server gateways.

```typescript
export class SocketServer {
  constructor(
    config: SocketIOConfig,
    authenticator: IAuthenticator,
    driverNamespace: DriverNamespace,
    eventBus?: any,
    obsDeps?: SocketObservabilityDeps
  );
  
  public async start(): Promise<void>;
  public async stop(): Promise<void>;
  public routeBusEvent(event: MotusEvent): void;
}
```

### Config Parameters (SocketIOConfig)

- `port`: Port to listen.
- `path`: Endpoint mount path.
- `corsOrigin`: CORS origin limits.
- `connectionStateRecovery`: Settings to enable recovery.
- `limits`: Max limits per socket/IP.

---

## 2. Interface: IAuthenticator

Hook to validate authorization tokens during connection upgrades.

```typescript
export interface IAuthenticator {
  authenticate(handshakeData: {
    token?: string;
    auth?: Record<string, any>;
    query?: Record<string, any>;
  }): Promise<AuthContext>;
}

interface AuthContext {
  tenantId: string;
  driverId?: string;
}
```

### Custom Authenticator Example

```typescript
import { IAuthenticator, AuthContext } from "@motus/socketio";

export class JwtAuthenticator implements IAuthenticator {
  public async authenticate(handshakeData: any): Promise<AuthContext> {
    const token = handshakeData.auth?.token;
    const decoded = verifyJwt(token);

    return {
      tenantId: decoded.tenantId,
      driverId: decoded.driverId,
    };
  }
}
```

---

## 3. Class: ConnectionRegistry

Tracks active socket connections.

```typescript
export class ConnectionRegistry {
  public register(socketId: string, auth: AuthContext, socket: Socket): void;
  public deregister(socketId: string): ConnectionEntry | null;
  public getDriverConnectionCount(driverId: string): number;
}
```

---

## 4. Class: SocketIOTransportAdapter

Binds core event dispatch operations to socket room emissions.

```typescript
export class SocketIOTransportAdapter {
  public async start(): Promise<void>;
  public async stop(): Promise<void>;
}
```
