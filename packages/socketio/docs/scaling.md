# Scaling & Performance Guidelines

This guide details guidelines, SLOs, and configurations required to scale the `@motus/socketio` gateway from 10K to 1M concurrent connections.

## Target Scaling Architecture

```
               ┌──────────────────────────────┐
               │    NLB / L4 Load Balancer    │
               └──────────────┬───────────────┘
                              │ Sticky Sessions
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  SocketServer   │  │  SocketServer   │  │  SocketServer   │
│     Node A      │  │     Node B      │  │     Node C      │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │
         └──────────┬─────────┴──────────┬─────────┘
                    ▼                    ▼
         ┌─────────────────────────────────────────┐
         │       Redis Pub/Sub scaling bus         │
         └─────────────────────────────────────────┘
```

---

## Concurrency Benchmarks & Profiles

### 1. 10K Connections (Single Node)
- **Use Case**: Small regional deployment or development setup.
- **Node Spec**: 1 vCPU, 1GB RAM.
- **Settings**:
  - `pingIntervalMs`: 10000 (10s)
  - `pingTimeoutMs`: 5000 (5s)
- **Profile**: Fits comfortably in single Node.js heap limit (< 500MB). CPU load stays < 10% under active driver location streaming.

### 2. 100K Connections (Cluster Mode)
- **Use Case**: Medium enterprise multi-city fleet tracking.
- **Node Spec**: 3-5 Nodes (each 2 vCPU, 2GB RAM).
- **Setup**: Requires L4 Load Balancer (AWS NLB) with client IP stickiness and Redis Cluster backing `RedisAdapterManager`.
- **Settings**:
  - `pingIntervalMs`: 25000 (25s)
  - `pingTimeoutMs`: 20000 (20s)
  - `maxPayloadSizeBytes`: 1e5 (100KB)
- **Profile**: Peak spatial decimation saves up to 70% of outgoing telemetry bandwidth, maintaining P95 latencies < 25ms.

### 3. 1M Connections (Large Scale Grid)
- **Use Case**: Nationwide real-time transport dispatch grid.
- **Node Spec**: 30-50 Nodes (each 4 vCPU, 4GB RAM).
- **Settings**:
  - `pingIntervalMs`: 45000 (45s)
  - `pingTimeoutMs`: 30000 (30s)
  - `limits.maxRoomsPerSocket`: 50
- **Throttling rules**: Handshake rate limiter is mandatory (limit handshakes to 500/sec per node) to prevent CPU starvation during network storms.

---

## SLO Targets & Performance Metrics

- **Websocket handshake duration**: P99 < 150ms.
- **Cross-node broadcast latency (Redis -> WebSocket client)**: P95 < 25ms, P99 < 60ms.
- **Zero Heap Crashes**: Zero out-of-memory errors during 10K coordinate streams/sec.
