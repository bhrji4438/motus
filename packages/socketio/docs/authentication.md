# Pluggable Authentication Guide

This guide explains how to configure and extend connection-level authentication for the `@motus/socketio` gateway.

## The Authentication Lifecycle

Authentication is executed during the Socket.IO connection namespace handshake. The workflow is orchestrated by `AuthenticationManager`.

```
Client Handshake Query ──► Extract tenantId ──► IAuthenticator.authenticate()
                                                      │
             Accept connection ◄─── AuthContext ◄─────┤ (Success)
                                                      │
             Reject connection ◄─── MotusError ◄──────┘ (Fail)
```

1. **Extract Tenant Context**: Every connection request must specify a valid `tenantId` in the handshake query or authorization metadata.
2. **Execute Authenticator**: The `SocketServer` delegates the token verification process to the registered `IAuthenticator` implementation.
3. **Register AuthContext**: On validation success, an `AuthContext` is returned containing the client's credentials (e.g. `driverId` if the client is a driver, `userId` for dispatchers) and stored on `socket.data.auth`.
4. **Enforce Tenant Isolation**: The manager asserts that the resolved tenant ID in the token context matches the query parameters.
5. **Periodic Token Expiration**: If a token expiration time is provided (`tokenExpiresAt` in `AuthContext`), the server configures a disconnect timer. When it expires, a warning frame `auth:expired` is emitted, and the socket is safely disconnected.

---

## The `IAuthenticator` Interface

To hook into your custom authentication system (such as JWT, OAuth, or Session stores), implement the `IAuthenticator` interface:

```typescript
import { IAuthenticator, AuthContext } from '@motus/socketio';

export class CustomJWTAuthenticator implements IAuthenticator {
  async authenticate(handshakeData: {
    token?: string;
    auth?: Record<string, any>;
    headers?: Record<string, any>;
    query?: Record<string, any>;
  }): Promise<AuthContext> {
    const token = handshakeData.token;
    if (!token) {
      throw new Error('Missing authentication token.');
    }

    try {
      // Decode and verify JWT
      const decoded = verifyJWT(token);

      return {
        tenantId: decoded.tenant,
        driverId: decoded.role === 'driver' ? decoded.sub : undefined,
        userId: decoded.role !== 'driver' ? decoded.sub : undefined,
        tokenExpiresAt: decoded.exp * 1000 // In milliseconds
      };
    } catch (err) {
      throw new Error('Invalid or expired token.');
    }
  }
}
```

Then register it during server creation:

```typescript
const server = new SocketServer(
  config,
  new CustomJWTAuthenticator(),
  driverNamespace
);
```
