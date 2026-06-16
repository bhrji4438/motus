# Troubleshooting & Diagnostics - Vectro Platform

This document describes how to debug, trace, and resolve common issues encountered on the Vectro platform in production.

---

## 1. Stale Driver Locations or Heartbeat Drops

### Symptoms

- Drivers appear online in the database but are never selected by the matching engine.
- Driver location updates are not broadcast to active session rooms.

### Diagnostic Steps

1.  **Check Heartbeat Timestamps**: Verify the `lastHeartbeat` timestamp inside the driver's profile hash:
    ```bash
    HGETALL tenant:{tenantId}:driver:{driverId}
    ```
2.  **Verify Location Expiry**: Check if the driver is in the active presence zset:
    ```bash
    ZSCORE tenant:{tenantId}:presence:active {driverId}
    ```
3.  **Confirm Geo Index Membership**: Ensure the driver's spatial registration exists inside the spatial index:
    ```bash
    GEOPOS tenant:{tenantId}:drivers:geo {driverId}
    ```

### Resolution

- If the location key is missing, check if the client application is successfully streaming socket heartbeats to `/drivers`.
- Ensure the background `DriverStaleDetector` worker daemon is running. If not running, stale locations won't be pruned, leading to matching timeouts.

---

## 2. Redlock Lock Timeouts & Wave Failures

### Symptoms

- State machine returns `ConcurrencyLockError` when a driver accepts a wave offer.
- Wave dispatching loops pause or time out.

### Diagnostic Steps

1.  **Search for Lock Keys**: Query if a candidate lock currently exists for the driver in that session:
    ```bash
    GET lock:candidate:{driverId}:session:{sessionId}
    ```
2.  **Check Lock Ownership**: The lock value should correspond to the active `sessionId`. If the value is different, the driver is reserved for another session.
3.  **Validate Lock TTL**: Check the remaining TTL:
    ```bash
    TTL lock:candidate:{driverId}:session:{sessionId}
    ```

### Resolution

*   Ensure lock TTL values match your network latency tolerances. If connection speeds are slow, increase the lock TTL or reduce wave timeout configurations.
*   Ensure all Redis keys use **hash tags** (`{tenantId}`) so that the Lua scripts can atomically verify lock states on the same node slot.

---

## 3. Event Bus Outbox Lags & Stream Saturation

### Symptoms

*   Outbound events are delayed or fail to post to external queues (Kafka, RabbitMQ).
*   High Redis memory consumption due to growing session stream keys.

### Diagnostic Steps

1.  **Measure Stream Length**: Check the number of unprocessed entries inside the outbox streams:
    ```bash
    XLEN tenant:{tenantId}:session:{sessionId}:events
    ```
2.  **Check Outbox Workers**: Ensure the async outbox processor is actively consuming messages:
    ```bash
    XREAD GROUP outbox_group worker_1 COUNT 10 STREAMS tenant:{tenantId}:session:{sessionId}:events >
    ```

### Resolution

*   Ensure outbox workers acknowledge entries (`XACK`) immediately after publishing them to external message brokers.
*   Verify that session stream TTL constraints (24 hours) are actively enforced to prevent Redis memory exhaustion.
