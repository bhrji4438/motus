# Production Deployment Guide - Motus Platform

This document describes how to deploy the Motus platform in production environments, covering horizontal scaling, Redis Cluster sharding, sticky load balancing, cleanup workers, and security settings.

---

## 1. System Requirements

- **Node.js**: v18.0.0 LTS or higher.
- **Redis**: v6.2 or higher (Redis Cluster or Sentinel configuration recommended).
- **Memory**: Since all active sessions are cached in-memory, size your Redis instances to host the peak concurrency loads (approx. 1.2 KB per active driver presence and 2 KB per active tracking session).

---

## 2. Redis Cluster Configuration

For high availability and linear scaling, configure a Redis Cluster.

### Config Options

Within `@motus/redis`, configuration is defined in the connection config. Ensure you set the nodes parameters:

```env
REDIS_MODE=cluster
REDIS_NODES=redis-node-1:6379,redis-node-2:6379,redis-node-3:6379
REDIS_PASSWORD=your-secure-redis-auth-token
```

### Memory Settings & Eviction Policy

- Set `maxmemory-policy noeviction` in your `redis.conf` file.
- _Rationale_: Evicting session states during active trips will break the matching state machines and cause double-bookings.
- Instead of eviction, manage memory limits using strict TTL configurations:
  - Completed sessions and telemetry streams are automatically pruned using a 24-hour expiration window.
  - Inactive driver locations are cleared from geo sets after a 5-minute heartbeat failure timeout.

---

## 3. WebSocket Sticky Load Balancing

Because Socket.IO clients maintain persistent websocket connections and utilize namespaces/rooms, ensure your ingress proxy (e.g. HAProxy, Nginx, or AWS ALB) terminates SSL and balances connections with **sticky sessions**.

### HAProxy Sample Configuration

```haproxy
backend motus_websocket_servers
    mode http
    balance roundrobin
    cookie SERVERID insert indirect nocache
    server server1 10.0.0.10:8080 check cookie server1
    server server2 10.0.0.11:8080 check cookie server2
```

### Nginx Sample Configuration

```nginx
upstream motus_servers {
    ip_hash;
    server 10.0.0.10:8080;
    server 10.0.0.11:8080;
}

server {
    listen 443 ssl;
    server_name api.motus-platform.org;

    location / {
        proxy_pass http://motus_servers;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

---

## 4. Background Workers & Lifecycles

Ensure background cleanup workers are running to manage deadlocks and stale presence profiles.

- **Driver Lost Monitor (`DriverLostMonitor`)**: Detects socket connection losses and sets presence to `STALE`.
- **Driver Stale Detector (`DriverStaleDetector`)**: Transitions driver presence to `OFFLINE` if no heartbeat is received within 120 seconds.
- **Presence Cleanup Worker (`CleanupWorker`)**: Removes expired location records from Redis Geo Indexes.
- **Wave Timeout Worker (`FanoutTimeoutWorker`)**: Reassigns active waves if the offering driver fails to respond within the 8-second wave time window.

### Running Workers

Ensure these processes run inside a daemon manager (e.g. PM2, Kubernetes deployments, or Systemd units):

```bash
# PM2 startup example
pm2 start dist/internal/workers/presence/DriverStaleDetector.js --name "driver-stale-detector"
pm2 start dist/internal/workers/fanout/FanoutTimeoutWorker.js --name "fanout-timeout-worker"
```
