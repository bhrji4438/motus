# Product Workflows & Data Flows - Motus Platform

This document describes the end-to-end business workflows, module interactions, data lifecycles, and realtime communication paths of the Motus engine.

---

## 1. End-to-End Dispatch Lifecycle Workflow

The core purpose of Motus is coordinating driver locations and dispatch sessions. Below is the complete sequence of events from driver onboarding to trip completion:

```mermaid
sequenceDiagram
    autonumber
    actor Driver
    participant App as Consuming App
    participant Motus as Motus Engine
    participant Redis as Redis Cache
    actor Passenger

    Note over Driver, Redis: Step A: Presence & Tracking
    Driver->>Motus: Connect to /drivers WebSocket Namespace
    Motus->>Redis: Set driver presence status to ONLINE
    Driver->>Motus: Stream location coordinate update {lat, lng}
    Motus->>Redis: Update active-locations geo index (GEOADD)
    Motus->>Redis: Store coordinate in driver:location hash (TTL 300s)

    Note over Passenger, Motus: Step B: Booking & Matching Session
    Passenger->>App: Book a Ride
    App->>Motus: Create Session (sessionId, pickupCoord, destCoord, filters)
    Motus->>Redis: Create session hash state: CREATED
    Motus-->>App: Event: session.created

    Motus->>Motus: Transition state to SEARCHING
    Motus->>Redis: Query nearby ONLINE drivers in GEO index (GEORADIUS)
    Motus->>Motus: Apply filters (capacity, vehicleType, freshness)
    Motus->>Motus: Rank candidates by distance/ETA

    rect rgb(240, 240, 240)
        Note over Motus, Driver: Step C: Progressive Wave Offering
        Motus->>Redis: Set Wave Offer Lock on candidate (driverId: lock)
        Motus-->>App: Event: dispatch.wave.started (notified candidate list)
        App->>Driver: Notify Push Offer (FCM/APNs)

        alt Driver Accepts Offer
            Driver->>Motus: Submit Accept Command (driverId, sessionId, waveNumber)
            Motus->>Redis: Validate and acquire lock atomically (Lua script check)
            Motus->>Redis: Transition driver presence to BUSY
            Motus->>Redis: Transition session state to DRIVER_ASSIGNED
            Motus-->>App: Event: session.assigned
        else Wave Expirations (8s Timeout)
            Motus->>Redis: Release lock
            Motus->>Motus: Increment waveNumber, fetch next batch, start Wave 2
        end
    end

    Note over Driver, Passenger: Step D: Transit & Telemetry Ingestion
    Driver->>Motus: Transition state to DRIVER_EN_ROUTE
    Driver->>Motus: Stream locations during transit
    Motus->>Motus: Telemetry Sampler filters points (10s or 25m check)
    Motus->>Redis: Stream coordinate append (XADD session:telemetry)
    Motus->>Redis: Publish coordinate to session room channel (Redis Pub/Sub)
    Motus-->>Passenger: Realtime WebSocket coordinate broadcast

    Driver->>Motus: Transition state to ARRIVED (at pickup)
    Driver->>Motus: Transition state to IN_PROGRESS (trip starts)
    Driver->>Motus: Transition state to COMPLETED (trip ends)

    Note over Motus, App: Step E: Archival & Cleanup
    Motus-->>App: Event: session.completed
    Motus->>Redis: Read entire telemetry path stream & compile summary report
    Motus->>App: Deliver Session Report (telemetry path, logs, timestamps)
    Motus->>Redis: Prune transient session and telemetry stream (TTL 24h)
    Motus->>Redis: Reset driver presence status to ONLINE
```

---

## 2. Platform Request Lifecycle

Requests entering the Motus system flow through two distinct channels:

### A. Control Path (REST API / Admin Commands)

Used by the Consuming Application to configure systems and manage static configurations:

1.  **Register Tenant:** Registers a new tenant and sets default configurations (radius, timeouts).
2.  **Register/Update Driver Master Data:** Saves driver capacities and vehicle specifications.
3.  **Create/Cancel/Reassign Sessions:** Triggers state changes from the booking backend.

### B. Realtime Path (WebSockets)

Used directly by mobile apps/drivers for high-frequency coordinate streaming and wave notifications:

1.  **Location Heartbeats:** High-speed coordinates ingested into the `/drivers` socket channel.
2.  **Tracking Subscriptions:** Customers subscribe to `/sessions` rooms to receive live coordinate updates.

---

## 3. Realtime Coordinate Stream & Pub/Sub Flow

To support scaling across multiple server pods, live tracking coordinates are broadcast using Redis Pub/Sub:

```mermaid
flowchart LR
    DriverApp["Driver Client App"] -->|Socket: location_update| Pod1["Motus Socket Pod A"]
    CustomerApp["Customer Client App"] -->|Socket: join_room sessionId| Pod2["Motus Socket Pod B"]

    Pod1 -->|Redis Pub/Sub: publish tracking channel| RedisPubSub(("Redis Pub/Sub\n(motus:tenant...channel)"))
    RedisPubSub -->|Subscribe| Pod2
    Pod2 -->|Socket: tracking_broadcast| CustomerApp
```

1.  **Ingestion**: Driver streams coordinates to the socket server pod they are connected to (Pod A).
2.  **Local Processing**: Pod A executes the Telemetry Sampler in `@motus/core`. If the update passes the distance/time threshold, it is stored in the Redis Stream.
3.  **Cluster Fanout**: Pod A publishes the coordinate to the Redis Pub/Sub channel associated with that specific session.
4.  **Distribution**: Pod B (which has the Customer Client connected to the session tracking room) receives the message from Redis Pub/Sub and emits the coordinate to the customer's web socket.

---

## 4. Notification Dispatch Pipeline

When the `WaveDistributor` starts a new wave, the notifications subsystem triggers push alerts:

```mermaid
flowchart TD
    CoreEngine["Core Wave Distributor"] -->|Triggers Notification| Template["Template Manager\n(Selects 'new_offer' template)"]
    Template -->|Fills Context| Targeting["Targeting Engine\n(Looks up active driver device tokens)"]
    Targeting -->|Fetch Preference| Preference["Preference Store\n(Verifies user has push enabled)"]
    Preference -->|Route Provider| ProviderRouter["Provider Router"]

    ProviderRouter -->|APNs| APNs["Apple Push Notification API"]
    ProviderRouter -->|FCM| FCM["Firebase Cloud Messaging API"]
    ProviderRouter -->|OneSignal| OneSignal["OneSignal Push API"]

    APNs -->|Success/Failure| Tracker["Delivery Tracker\n(Logs receipts & latencies)"]
    FCM -->|Success/Failure| Tracker
    OneSignal -->|Success/Failure| Tracker
```

---

## 5. Telemetry Path Sampling Flow

Raw GPS feeds contain coordinate drift and redundant stationary points. The `TelemetrySampler` filters points to minimize Redis storage:

```
                  +--------------------------------+
                  |  Raw Location Heartbeat Ingest |
                  +--------------------------------+
                                  |
                                  v
             Is this the first coordinate in the session?
               /                                  \
             YES                                  NO
             /                                      \
            v                                        v
     [Save Coordinate]                Is time delta since last point > 10s?
     [Emit telemetry.sampled]           OR distance movement since last point > 25m?
                                          /                            \
                                        YES                            NO
                                        /                                \
                                       v                                  v
                               [Save Coordinate]                 [Discard Heartbeat]
                               [Emit telemetry.sampled]          [Presence Updated Only]
```

1.  **Distance Calculation**: Evaluates distance using the Haversine formula (straight-line distance).
2.  **Sampling**: Saves points only if the driver has moved $\ge 25\text{ meters}$ or if $\ge 10\text{ seconds}$ have elapsed since the last saved point.
3.  **Compression**: When a session completes, the telemetry array is encoded using the Google Encoded Polyline format for low-payload transmission to the consuming application.
