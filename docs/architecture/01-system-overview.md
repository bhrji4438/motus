# 01 - System Overview

This document describes the high-level system architecture of Motus, the open-source real-time dispatch and tracking engine. It maps the overall topology, system boundaries, interaction flows between drivers, tenants, session lifecycles, and external consumer systems.

---

## Architectural Topology

Motus is a high-throughput, low-latency engine designed specifically to handle spatial-temporal data ingestion, stateful dispatch matching, progressive wave offerings, and real-time session tracking. It acts as an orchestrator alongside, but decoupled from, primary consumer application databases.

```mermaid
flowchart TB
    subgraph ClientLayer [Client Layer]
        DriverApp["Driver Client App\n(Location Ingestion, Wave Offers)"]
        ConsumerApp["Consumer Client App\n(Realtime Tracking Map)"]
    end

    subgraph LoadBalancer [Load Balancing & Routing]
        IngressProxy["Nginx / HAProxy\n(SSL Termination, Sticky Sessions)"]
    end

    subgraph MotusEngine [Motus Monorepo Platform]
        RESTServer["REST Server\n(@motus/server)\n- Tenant/Driver Admin\n- Session Lifecycle Ingestion"]
        SocketServer["Socket.io Server\n(@motus/socketio)\n- Location Ingest\n- Active Session Rooms\n- Driver Offer Channels"]
        CoreLib["Core Dispatch Library\n(@motus/core)\n- State Machine Logic\n- Matching Filters\n- Geofencing Rules\n- Telemetry Sampler"]
        RedisLib["Redis Adapter\n(@motus/redis)\n- Lock/Presence Mgr\n- Geo Sets & Indexes\n- Streams & Pub/Sub"]
    end

    subgraph DataStorage [State & Cache Layer]
        RedisCluster[("Redis Cluster\n(Distributed Presence, Locations,\nSession Cache, Locks, Streams)")]
    end

    subgraph ExternalConsumers [Consumer Boundary (Third-Party)]
        ConsumerBackend["Consumer Backend API\n(Bookings, Orders, Payments, Users)"]
        ConsumerDB[("Consumer RDBMS / Document DB\n(Persistent System of Record)")]
        ExternalETA["Routing & ETA Provider\n(Google Maps, OSRM, Valhalla)"]
        EventBroker["External Event Broker\n(Kafka, RabbitMQ, SNS)"]
    end

    %% Network Connections
    DriverApp -->|WS: Heartbeat & Location| IngressProxy
    ConsumerApp -->|WS: Sub to Session Room| IngressProxy
    IngressProxy --> RESTServer
    IngressProxy --> SocketServer
    
    RESTServer --> CoreLib
    SocketServer --> CoreLib
    CoreLib --> RedisLib
    RedisLib --> RedisCluster

    %% External System Connections
    ConsumerBackend -->|REST API Calls| RESTServer
    RESTServer -.->|Outbox Events| EventBroker
    CoreLib -->|Query Router| ExternalETA
    ConsumerBackend --> ConsumerDB
    EventBroker -.->|Listen to Events| ConsumerBackend
```

---

## Responsibilities

Motus defines strict system boundaries to maintain a separation of concerns between real-time dispatch operations and core consumer business logic.

### Motus-Owned Domain
*   **Driver Presence:** Tracking online, busy, paused, stale, and offline states of active drivers.
*   **Driver Locations:** Dynamic spatial indexing of active driver coordinates.
*   **Matching & Routing Pipeline:** Finding optimal candidates based on spatial proximity, capacity limits, zone geofencing, and ETA metrics.
*   **Progressive Fanout (Wave Engine):** Managing atomic, sequential wave offers to selected drivers, locking candidates, and handling accept/reject cycles.
*   **Session Lifecycle Management:** Stateful transitions of transient dispatch and tracking sessions.
*   **Realtime Tracking:** Distributing live coordinates to subscribing client sessions.
*   **Telemetry Processing:** Spatial-temporal path sampling (25m/10s logic) and route replay archiving.
*   **Outbound Event Emission:** Publishing domain state events to external queues or webhooks.
*   **Operational Reporting:** Generating session summary records containing telemetry and state changes.

### Consumer-Owned Domain
*   **Bookings & Orders:** Defining customer requests, fulfillment statuses, and business workflows.
*   **User Management:** Customer identity, profiles, and authorization models.
*   **Payments & Billing:** Credit card auth, driver payouts, currency handling, and invoices.
*   **Core Pricing Engines:** Calculating dynamic fares, distance rates, and tenant commissions.
*   **Customer Notifications:** Sending push messages, SMS, or emails to drivers or clients (Motus only informs the backend that an event occurred).
*   **Historical Analytics:** Long-term business intelligence, mapping performance trends over months or years.
*   **Persistent Database of Record:** Cold storage of customer accounts, transaction histories, and completed order logs.

---

## Dependencies

1.  **Redis (High-Priority):** Motus relies on Redis as its low-latency shared memory layer. Redis handles transient presence states, geo-indices for matching, atomic locking, internal Pub/Sub for socket scaling, and telemetry buffer streams.
2.  **External ETA Routing Engine (Optional/Pluggable):** Required for ETA-based ranking (e.g., OSRM, Google Maps). Motus provides distance-based matching (Haversine) as a native fallback if the external service fails or is disabled.
3.  **External Message Broker (Optional/Pluggable):** For publishing outbox domain events to the consumer's environment (e.g., Kafka, RabbitMQ).

---

## Boundaries & Isolation

*   **Logical Tenancy Isolation:** All keys in the Redis storage layer, event channels, and tracking rooms are partitioned using a structured tenant prefix (`motus:tenant:{tenantId}:...`).
*   **Execution Isolation:** The core business rules and state machines are isolated from the networking layers. They run in a sandbox-friendly, package-decoupled codebase (`@motus/core`).

---

## Failure Scenarios

*   **Redis Node Outage:** A failover event triggers client reconnection. In-flight wave offers during a failover are handled gracefully by checking presence states and session variables upon socket reconnect.
*   **External ETA Provider Latency Spike:** The matching pipeline uses an optimistic execution window. If the routing engine fails to return within the timeout, the pipeline falls back to straight-line distance calculations to prevent dispatch starvation.
*   **Driver Connection Drop during Active Wave:** If a driver loses connection during an open offer, the `STALE` Presence worker detects the drop, marks the driver as unavailable, and the Fanout engine proceeds to the next candidate wave.

---

## Architectural Tradeoffs

*   **InMemory Cache-First State vs. Persistent Transactional DB:** Motus prioritizes sub-millisecond latencies and high throughput by hosting active states in memory (Redis). Long-term persistence is delegated to the consumer application through outbound events. This simplifies the scaling of the engine but requires consumers to maintain the permanent system of record.
*   **Sticky Session WebSocket Routing:** To minimize lookup times and maintain stable room pipelines, client connections should be balanced with sticky sessions, routing driver connections efficiently to targeted server pods.

---

## Future Considerations

*   **Distributed State Synchronization:** Transitioning from simple Redis clustering to multi-datacenter edge replication for global tenants, enabling drivers to stream locations to local regions while keeping global status queries synchronized.
*   **Service Mesh Event Routing:** Utilizing dedicated event brokers (such as NATS JetStream) inside the monorepo boundary to replace Redis Streams for internal inter-process messaging as cluster sizes exceed 100,000 active nodes.
