# API Reference - @motus/socketio

This document details the classes, configurations, and adapter contracts of the `@motus/socketio` package.

---

## 1. Class: SocketServer

Configures, secures, and executes the Socket.IO server gateways.

```typescript
export class SocketServer {
  constructor(config: SocketIOConfig, authenticator?: IAuthenticator);
  public attach(server: http.Server | HTTPServer): void;
  public getRegistry(): ConnectionRegistry;
}
```

### Config Parameters

- `port`: Port to listen.
- `path`: Endpoint mount path.
- `corsOrigin`: CORS origin limits.

---

## 2. Interface: IAuthenticator

Hook to validate authorization tokens during connection upgrades.

```typescript
export interface IAuthenticator {
  authenticate(handshake: HandshakeRequest): Promise<AuthContext>;
}

interface AuthContext {
  tenantId: string;
  userId: string;
  roles: string[];
}
```

### Custom Authenticator Example

```typescript
import { IAuthenticator, AuthContext } from "@motus/socketio";

export class JwtAuthenticator implements IAuthenticator {
  public async authenticate(handshake: any): Promise<AuthContext> {
    const token = handshake.auth.token;
    const decoded = verifyJwt(token);

    return {
      tenantId: decoded.tenantId,
      userId: decoded.userId,
      roles: decoded.roles,
    };
  }
}
```

---

## 3. Class: ConnectionRegistry

Tracks active socket connections.

```typescript
class ConnectionRegistry {
  public register(tenantId: TenantId, userId: string, socketId: string): void;
  public unregister(socketId: string): void;
  public getSocketId(tenantId: TenantId, userId: string): string | null;
}
```

---

## 4. Class: SocketIOTransportAdapter

Binds core event dispatch operations to socket room emissions.

```typescript
class SocketIOTransportAdapter implements TransportAdapter {
  public async emitToUser(
    tenantId: TenantId,
    userId: string,
    eventName: string,
    payload: any
  ): Promise<void>;
  public async emitToRoom(
    tenantId: TenantId,
    roomName: string,
    eventName: string,
    payload: any
  ): Promise<void>;
}
```

- `emitToRoom`: Internally triggers socket broad-casts inside the `motus:tenant:{tenantId}:session:{sessionId}:tracking` namespaces.
