# Troubleshooting Guide

This guide helps you identify and resolve common runtime issues encountered within the `@motus/socketio` gateway layer.

## Connection Problems

### 1. Client Disconnected with `MOTUS_UNAUTHORIZED`
- **Cause**: The client did not provide a token, or the registered `IAuthenticator` threw an authentication error, or the `tenantId` in the handshake query did not match the resolved token.
- **Resolution**:
  - Verify that the `tenantId` is included in the query string (`?tenantId=tnt_abc`).
  - Verify that the client is sending the correct token in the connection metadata (`auth: { token: '...' }`).
  - Check the server logs for `Handshake rejected: TenantId mismatch` or `Invalid authentication token`.

### 2. Socket Handshake Disconnects Instantly (General Error)
- **Cause**: Maximum payload limits exceeded or IP connections limit hit.
- **Resolution**:
  - Check the `maxPayloadSizeBytes` configuration if you stream custom telemetry payloads.
  - Assert that client proxies (Nginx, AWS ALB) support WebSocket protocol upgrades and long-lived TCP connections.

---

## Redis Adapter Scaling Outages

### 1. Events Not Broadcasted Across Nodes
- **Cause**: Redis pub/sub client went offline, or `RedisAdapterManager` channel prefixes mismatch.
- **Resolution**:
  - Check the server logs for `Redis adapter client closed` or `REDIS_CONNECTION_ERROR`.
  - Check that the `redis.channelPrefix` configuration matches on all instances.
  - Verify Redis memory usage; if the pub/sub queue fills up, Redis might evict clients.

---

## Debugging Utilities

Enable debug logs by setting the environment variable:

```bash
DEBUG=socket.io*
```

This prints raw socket frame details, handshake logs, and room subscription triggers to standard output.
