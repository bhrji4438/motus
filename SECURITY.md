# Security Policy - Motus Platform

We take the security of the Motus platform and multi-tenant applications seriously. This document describes security configurations, isolation mechanisms, authentication practices, and instructions for reporting vulnerabilities.

---

## 1. Reporting a Vulnerability

If you discover a security vulnerability in the Motus monorepo, please do **NOT** open a public issue. Instead, report the vulnerability to the maintainers:

- Email: `security@motus-platform.org`
- Response Window: Maintainers will acknowledge receipt of the report within 24 hours and provide an estimated timeline for remediation.

We practice coordinated vulnerability disclosure, coordinate a fix, and publish a security advisory upon resolution.

---

## 2. Multi-Tenancy & Data Isolation

Motus enforces absolute data isolation between tenants to prevent cross-tenant information disclosure.

### Redis Storage Isolation

All cached records, locations, and telemetry buffers are partitioned using the tenant ID in the key prefix:

```
motus:tenant:{tenantId}:...
```

Repositories such as `RedisDriverRepository`, `RedisSessionRepository`, and `RedisPresenceRepository` utilize `TenantGuard` to validate that every operation matches the request's tenant ID, preventing cross-tenant leakage.

### Realtime Channel Isolation

- Websocket namespaces and rooms are prefixed with tenant-specific IDs: `motus:tenant:{tenantId}:session:{sessionId}:tracking`.
- A client connected to tenant `T1` is physically barred from subscribing to rooms or channels associated with tenant `T2`.

---

## 3. Realtime Authentication & Handshake

WebSocket connections must be authenticated before a socket upgrade is allowed.

### IAuthenticator Interface

The `@motus/socketio` package utilizes the `IAuthenticator` interface. Implementing developers must override this authenticator to intercept handshakes:

1.  **Extract Tokens**: Extract authorization header tokens (such as JWTs) or query parameters from the initial Socket.IO connection request.
2.  **Validate Tenant**: Verify that the token corresponds to an active, valid tenant registration.
3.  **Assign Context**: Populates the `AuthContext` specifying the `tenantId`, `userId` (driver or customer ID), and `roles`. If authentication fails, the connection is rejected during the handshake.

---

## 4. Secure Production Configuration

When deploying Motus in a production environment:

1.  **SSL/TLS Termination**: Enforce `WSS` (Secure WebSockets) and `HTTPS` at the load balancer or proxy layer (e.g. Nginx, HAProxy, AWS ALB).
2.  **Sensitive Environment Settings**: Ensure all credentials, including Redis passwords, API tokens for push providers (APNs/FCM), and authentication secrets, are injected via environment variables and never committed to source control.
3.  **Connection Limits**: Enforce maximum connections per IP at the load balancer layer to prevent denial-of-service (DoS) attacks on websocket namespaces.
