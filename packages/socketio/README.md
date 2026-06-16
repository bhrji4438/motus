# @motus/socketio

Socket.IO transport gateway adapter for real-time location heartbeats.

---

## 1. Purpose

Establishes WebSocket connections with mobile devices to ingest high-frequency location heartbeats and broadcast live driver tracking positions to customer clients.

---

## 2. Installation

```bash
npm install @motus/socketio socket.io
```

---

## 3. Quick Start

```typescript
import http from "http";
import { SocketServer } from "@motus/socketio";

const server = http.createServer();
const socketServer = new SocketServer({ port: 8080 });
socketServer.attach(server);
```

---

## 4. Configuration

Exposes connection config parameters (port, path, corsOrigin). Hook custom authenticators using the `IAuthenticator` interface.

---

## 5. Common Use Cases

- Managing `/drivers` namespace connections for heartbeats and offer responses.
- Managing `/sessions` namespace tracking rooms.
- Validating handshakes.
- Enforcing connection recovery mappings on socket disruptions.

---

## 6. API Reference Link

- [API Reference: @motus/socketio](../../docs/api-reference/socketio.md)

---

## 7. Related Modules

- `@motus/core` — Location logic namespaces.
- `@motus/redis` — Pub/Sub channel broadcasts.

---

## 8. Production Notes

Enable sticky sessions at the load balancer layer (HAProxy/Nginx) to route websocket handshakes to the same server node.

---

## 9. Limitations

Does not handle core business transactions; it serves as a network gateway layer forwarding commands to the underlying `@motus/core` managers.

---

## 10. Examples

Detailed socket configuration examples can be found in the [Realtime Communication Module Page](../../docs/modules/realtime-communication.md).
