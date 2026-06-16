# Troubleshooting & Diagnostics - Motus Platform

This document describes how to debug, trace, and resolve common issues encountered on the Motus platform in production.

---

## 1. Stale Driver Locations or Heartbeat Drops

### Symptoms

- Drivers appear online in the database but are never selected by the matching engine.
- Driver location updates are not broadcast to active session rooms.

### Diagnostic Steps

1.  **Check Heartbeat timestamps**: Verify the `lastHeartbeat` timestamp inside the driver's presence hash:
    ```bash
    HGETALL motus:tenant:{tenantId}:driver:{driverId}:presence
    ```
2.  **Verify Location Hash TTL**: Check if the driver's location key has expired (should have a 300s TTL):
    ```bash
    TTL motus:tenant:{tenantId}:driver:{driverId}:location
    ```
3.  **Confirm Geo Index Membership**: Ensure the driver's spatial registration exists inside the spatial index:
    ```bash
    GEOPOS motus:tenant:{tenantId}:drivers:locations {driverId}
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

1.  **Search for Lock Keys**: Query if a lock currently exists for the driver:
    ```bash
    GET motus:tenant:{tenantId}:lock:driver:{driverId}
    ```
2.  **Check Lock Ownership**: The lock value should correspond to the active `sessionId`. If the value is different, the driver is reserved for another session.
3.  **Validate Lock TTL**: Check the remaining TTL:
    ```bash
    TTL motus:tenant:{tenantId}:lock:driver:{driverId}
    ```

````

### Resolution
*   Ensure lock TTL values (default 8s) match your network latency tolerances. If connection speeds are slow, increase the lock TTL or reduce wave timeout configurations.
*   Ensure all Redis keys use **hash tags** (`{tenantId}`) so that the Lua scripts can atomically verify lock states on the same node slot.

---

## 3. Event Bus Outbox Lags & Stream Saturation

### Symptoms
*   Outbound events are delayed or fail to post to external queues (Kafka, RabbitMQ).
*   High Redis memory consumption due to growing session stream keys.

### Diagnostic Steps
1.  **Measure Stream Length**: Check the number of unprocessed entries inside the outbox streams:
    ```bash
    XLEN motus:tenant:{tenantId}:session:{sessionId}:events
    ```
2.  **Check Outbox Workers**: Ensure the async outbox processor is actively consuming messages:
    ```bash
    XREAD GROUP outbox_group worker_1 COUNT 10 STREAMS motus:tenant:{tenantId}:session:{sessionId}:events >
    ```

### Resolution
*   Ensure outbox workers acknowledge entries (`XACK`) immediately after publishing them to external message brokers.
*   Verify that session stream TTL constraints (24 hours) are actively enforced to prevent Redis memory exhaustion.
````
