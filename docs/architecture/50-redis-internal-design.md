# 50 - Redis Internal Design

This document details the concrete Redis implementation, key-naming schemas, data structure selections, and the transaction Lua script catalog within `@motus/redis`.

---

## Key Naming & Cluster Slot Strategy

To support Redis Cluster sharding without hash-slot verification errors, all keys for a given tenant use hash tags:
`motus:tenant:{tenantId}:[module]:[entityId]`
This ensures all keys for a specific tenant are mapped to the same hash slot on a single cluster node, allowing multi-key transactional updates and Lua scripts to run safely.

---

## Data Structure Catalog

| Key Pattern | Structure | TTL | Operations Used | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| `motus:tenant:{tenantId}:driver:{driverId}:presence` | Hash | 24 Hours | `HSET`, `HGET`, `HMGET` | Presence state, capacity, and current active session counts. |
| `motus:tenant:{tenantId}:driver:{driverId}:location` | Hash | 300 Sec | `HSET`, `HGETALL` | Detailed location metadata (bearing, speed, accuracy). |
| `motus:tenant:{tenantId}:drivers:locations` | Sorted Set (Geo) | Persistent | `GEOADD`, `GEODEL`, `GEOSEARCH` | Geo-indexing for spatial queries. Drivers are explicitly deleted when offline or paused. |
| `motus:tenant:{tenantId}:session:{sessionId}` | Hash | 24 Hours | `HSET`, `HGETALL` | Session state, assigned driver, pickup/destination coordinate values. |
| `motus:tenant:{tenantId}:session:{sessionId}:telemetry` | Stream | 24 Hours | `XADD`, `XRANGE`, `DEL` | Persistent buffer for path collection during active trips. |
| `motus:tenant:{tenantId}:lock:driver:{driverId}` | String | 8 Seconds | `SET NX PX`, `GET`, `DEL` | Exclusive wave assignment locks. |
| `motus:tenant:{tenantId}:events:outbox` | Stream | 24 Hours | `XADD`, `XREADGROUP`, `XACK` | Outbox stream for transactional event dispatching. |

---

## Lua Script Catalog

To guarantee transactional safety and prevent race conditions, the following operations are implemented via Redis Lua scripts:

### 1. Candidate Reservation Lock (`candidate_reserve.lua`)
*   **Purpose:** Atomically locks candidate drivers for an active dispatch wave.
*   **Keys:**
    *   `KEYS[1]` to `KEYS[N]`: Lock keys (`motus:tenant:{tenantId}:lock:driver:{driverId}`)
    *   `KEYS[N+1]` to `KEYS[2N]`: Presence keys (`motus:tenant:{tenantId}:driver:{driverId}:presence`)
*   **Arguments:**
    *   `ARGV[1]`: `sessionId` (the lock value)
    *   `ARGV[2]`: `lockTtlMs` (8000ms)
*   **Logic:**
    1. Loop through candidates. Check if the lock key already exists or if driver presence is not `ONLINE`.
    2. If any check fails, abort and return a list of failed drivers.
    3. If all checks pass, write `SET lockKey sessionId PX lockTtlMs` for each candidate.
*   **Failure Scenario:** Returns a conflict list if a candidate has been locked by another session during matching calculations.

### 2. Assignment Acceptance (`accept_offer.lua`)
*   **Purpose:** Processes a driver's offer acceptance, updates states, and releases locks.
*   **Keys:**
    *   `KEYS[1]`: Lock key (`motus:tenant:{tenantId}:lock:driver:{driverId}`)
    *   `KEYS[2]`: Driver presence (`motus:tenant:{tenantId}:driver:{driverId}:presence`)
    *   `KEYS[3]`: Session profile (`motus:tenant:{tenantId}:session:{sessionId}`)
*   **Arguments:**
    *   `ARGV[1]`: `sessionId`
    *   `ARGV[2]`: `driverId`
*   **Logic:**
    1. Check lock value matches `sessionId`. If not, return `LOCK_MISMATCH_OR_EXPIRED`.
    2. Fetch driver presence state. Verify `currentLoad < capacity`. If not, return `DRIVER_UNAVAILABLE`.
    3. Fetch session state. Verify it is `SEARCHING`. If not, return `SESSION_STATE_NOT_SEARCHING`.
    4. Set session status to `DRIVER_ASSIGNED` and bind `assignedDriverId = driverId`.
    5. Increment driver `currentLoad`. If `currentLoad >= capacity`, set presence status to `BUSY`.
    6. Delete the reservation lock. Return success.

### 3. Session State Transition (`session_transition.lua`)
*   **Purpose:** Transitions session states atomically.
*   **Keys:**
    *   `KEYS[1]`: Session key (`motus:tenant:{tenantId}:session:{sessionId}`)
*   **Arguments:**
    *   `ARGV[1]`: Expected current state (e.g., `DRIVER_EN_ROUTE`)
    *   `ARGV[2]`: Target state (e.g., `ARRIVED`)
*   **Logic:**
    1. Load current session state.
    2. Verify it matches the expected current state. If not, return `STATE_MISMATCH`.
    3. Update the state to the target state. Return success.

### 4. Completion Processing (`session_complete.lua`)
*   **Purpose:** Completes a session and frees driver resources.
*   **Keys:**
    *   `KEYS[1]`: Session key (`motus:tenant:{tenantId}:session:{sessionId}`)
    *   `KEYS[2]`: Driver presence key (`motus:tenant:{tenantId}:driver:{driverId}:presence`)
*   **Arguments:**
    *   `ARGV[1]`: `driverId`
*   **Logic:**
    1. Load current session state. Verify it is `IN_PROGRESS` or `ARRIVED` or `DRIVER_LOST`.
    2. Set session state to `COMPLETED`.
    3. Decrement driver `currentLoad`. If driver status was `BUSY` and `currentLoad < capacity`, update status to `ONLINE`.
    4. Return success.

---

## Memory & Scale Considerations

1. **Memory Protection:** Every session, driver location, and outbox stream key has a TTL (usually 24 hours). This prevents Redis memory from growing unbounded.
2. **Eviction Safety:** Set `maxmemory-policy` to `noeviction` in production. This guarantees that Redis returns an error rather than evicting active session state or reservation locks under memory pressure.
3. **Write Pipeline Optimization:** High-frequency coordinate updates use pipelining to bundle `GEOADD` and `HSET` operations into single TCP network trips, improving throughput.
