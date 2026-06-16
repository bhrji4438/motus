# Redis Key Strategy Review

## Current State
A review of the initial architecture documents reveals inconsistencies in Redis key naming conventions. Specifically, we see mixes of:
*   `motus:tenant:{tenantId}:...` (e.g. in `04-redis-architecture.md`)
*   `motus:{tenantId}:...` (e.g. in some diagram labels)
*   `motus:{tenant:T1}:...` (e.g. in Lua script examples)

---

## Findings
1.  **Hashtag Positioning:** Redis Cluster determines key slot allocation by hashing the content enclosed inside curly braces `{...}`. If curly braces are not placed identically, keys representing the same tenant (e.g. `{tenantId}` vs `{tenant:tenantId}`) will hash to different slots.
2.  **Lua Script Execution:** Redis Cluster requires that all keys passed to a single Lua script map to the exact same hash slot. If a transaction attempts to modify a driver presence profile and write a session state concurrently, and they hash to different slots, the execution will crash with a `CROSSSLOT` error.

---

## Risks
*   **Cluster Failures (`CROSSSLOT` Errors):** If keys are not co-located in the same cluster slot, atomic multi-key operations (like lock verification and presence updating during a driver offer acceptance) will fail under Redis Cluster deployments.
*   **Code Complexity:** Inconsistent naming makes debugging and maintaining Lua scripts complex, leading to development friction.

---

## Recommended Changes

### A. Final Key Naming Convention
We establish a strict naming template for all Redis keys in Motus:
```
motus:tenant:{tenantId}:[domain]:[entityId]:[sub-key]
```
By placing `{tenantId}` early in the key pattern, we ensure that the bracketed tenant identifier is the *only* token hashed by Redis Cluster.

### B. Mapped Key Structures
Every key used in the platform is mapped to this naming convention:
*   **Driver Presence:** `motus:tenant:{tenantId}:driver:{driverId}:presence`
*   **Driver Location details:** `motus:tenant:{tenantId}:driver:{driverId}:location`
*   **Active Locations Index:** `motus:tenant:{tenantId}:drivers:locations`
*   **Session State:** `motus:tenant:{tenantId}:session:{sessionId}`
*   **Session Events Stream:** `motus:tenant:{tenantId}:session:{sessionId}:events`
*   **Telemetry Path Buffer Stream:** `motus:tenant:{tenantId}:session:{sessionId}:telemetry`
*   **Tracking Broadcast Channel:** `motus:tenant:{tenantId}:channel:session:{sessionId}:tracking`
*   **Offer Reservation Lock:** `motus:tenant:{tenantId}:lock:driver:{driverId}`

### C. Multi-Key Lua Compatibility Rules
All Lua scripts used in Motus must strictly adhere to the following:
*   Every key argument passed to the script (`KEYS[1]`, `KEYS[2]`, etc.) must have `{tenantId}` as its hashtag.
*   If a script needs to operate on coordinates or statuses, it cannot query across different tenants.
*   Example of passing correct cluster-slot keys:
    ```javascript
    // All keys contain the exact same {tenantId} hashtag
    const keys = [
      `motus:tenant:{${tenantId}}:lock:driver:${driverId}`,
      `motus:tenant:{${tenantId}}:driver:${driverId}:presence`,
      `motus:tenant:{${tenantId}}:session:${sessionId}`
    ];
    redis.eval(luaScript, keys.length, ...keys, sessionId, driverId);
    ```

---

## Final Decision
Standardize on the `motus:tenant:{tenantId}:...` convention across the entire codebase and documentation. The hashtag `{tenantId}` is designated as the sole cluster sharding anchor.

---

## Impact Analysis
*   **Clustering:** All tenant-specific data will sit on the same Redis cluster node. This optimizes memory lookups and guarantees Lua transaction safety.
*   **Scalability:** Allows horizontal scaling. Adding masters to the Redis Cluster scales the platform because tenants are distributed evenly across masters, while maintaining local atomic operations within each tenant's datasets.
*   **Cross-Tenant Analytics:** Cross-tenant aggregation cannot be executed natively in Redis using multi-key commands. This is an intentional architectural trade-off. Cross-tenant metrics are compiled by reading outbox events asynchronously outside Redis.

---

## Migration Notes
All references to keys in `04-redis-architecture.md`, `05-matching-architecture.md`, `06-fanout-architecture.md`, `07-session-architecture.md`, `08-tracking-architecture.md`, and `09-telemetry-architecture.md` are overridden by this strategy and must be aligned in the implementation phase.
