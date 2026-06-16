# 56 - Performance Analysis & Bottlenecks

This document identifies system bottlenecks under scale (e.g. 100k+ active drivers and sessions) and maps out engineering mitigations.

---

## Scalability Profiling & Bottlenecks

```
+-----------------------------------+------------------------------------------+
| High Risk Bottleneck Area        | Primary Architectural Mitigation          |
+-----------------------------------+------------------------------------------+
| Redis CPU Saturation              | Connection Pipelining, Ingestion Throttle|
| Telemetry RAM Exhaustion          | Lossy Sampling (25m/10s), Pruning on Complete |
| Routing Engine Latency Spikes     | 100ms Client Timeouts, Haversine Fallbacks|
| Outbox Dispatch Lag               | Consumer Group Scaling, Batch Processing |
| WebSocket Node Memory Saturation | Sticky Load Balancing, Horizontal Scaling|
+-----------------------------------+------------------------------------------+
```

---

## Deep-Dive Analysis & Mitigations

### 1. Redis CPU Saturation (High Driver & Coordinate Counts)
*   **Problem:** 100k drivers transmitting GPS coordinates every second generates 100k writes/sec to the geo index (`GEOADD`) and detail hashes (`HSET`). Under this load, the single-threaded Redis engine can experience thread blockages and high CPU usage.
*   **Mitigation Strategies:**
    1.  *Ingestion Throttling:* Enforce backpressure at `@motus/socketio` (discard pings within 1 second or if the vehicle speed is 0 and the time delta is under 5 seconds).
    2.  *TCP Pipelining:* Group spatial updates into pipeline batches (e.g. batching 50 updates per network trip) to reduce TCP context switching overhead.
    3.  *Cluster Slot Sharding:* Partition tenants across Redis cluster instances using hashtags (`{tenantId}`) to distribute the CPU load.

### 2. Telemetry RAM Exhaustion
*   **Problem:** Storing raw GPS coordinates for thousands of active multi-hour sessions can consume gigabytes of RAM in Redis.
*   **Mitigation Strategies:**
    1.  *Adaptive In-Memory Filtering:* Apply the 25m/10s delta sampling rule in `@motus/core` before writing to the database, discarding up to 90% of redundant coordinate records.
    2.  *Immediate Pruning:* Compile reports and delete the temporary telemetry streams from Redis (`DEL`) as soon as a session transitions to a terminal state (`COMPLETED` or `CANCELLED`).
    3.  *Compact Serialization:* Store telemetry stream coordinates as compact binary sequences rather than verbose JSON strings.

### 3. Routing Engine API Bottleneck
*   **Problem:** Sorting candidates by travel time requires querying an external routing API (OSRM/Valhalla). If the API slows down or times out, matching operations block, stalling the dispatch pipeline.
*   **Mitigation Strategies:**
    1.  *Strict Client Timeout:* Wrap the routing service call in a Promise with a strict 100ms timeout budget.
    2.  *Automatic Fallback:* If the timeout expires or the API fails, fall back to Haversine distance calculations instantly, logging a warning event.
    3.  *Candidate Capping:* Limit the candidate pool passed to the routing engine to the nearest 30 drivers based on Haversine distance, preventing massive multi-point routing requests.

### 4. Event Outbox Dispatch Lag
*   **Problem:** If the outbox worker publishes events to Kafka or webhook endpoints sequentially, a spike in session updates can cause a backlog, delaying external integrations.
*   **Mitigation Strategies:**
    1.  *Parallel Workers:* Scale outbox worker nodes horizontally using Redis Stream consumer groups (`XREADGROUP`) to process segments of the stream concurrently.
    2.  *Batch Publishing:* Configure workers to fetch events in batches (e.g., `COUNT 100` in `XREADGROUP`) and write to external message brokers in batch transactions.

### 5. WebSocket Connection Limits
*   **Problem:** Node.js process memory limits (typically 1.5GB) can restrict a single gateway server to ~20k-30k concurrent socket connections.
*   **Mitigation Strategies:**
    1.  *Horizontal Scaling:* Distribute connections across gateway instances using sticky load balancing and a synchronized `@socket.io/redis-adapter` Pub/Sub network.
    2.  *Garbage Collection Tuning:* Tune the Node.js garbage collector runtime flags (`--max-old-space-size=4096`) to allow optimal heap allocation.
