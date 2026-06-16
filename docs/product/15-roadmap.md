# 15. Roadmap

## Purpose
This document outlines the product evolution strategy and future feature roadmap for Motus. It defines the progression from the foundational V1 real-time dispatch and tracking platform to an advanced, machine-learning-driven multi-passenger pooling and routing coordination system.

---

## Roadmap Milestones & Phases

```
   Phase 1 (V1)           Phase 2 (V2)           Phase 3 (V3)
  [Foundations]   ➔    [Route Intelligence]  ➔  [Autonomous & Pooling]
  - Presence           - Route-Aware Capacity  - Multi-Passenger Ride Sharing
  - Wave Fanout        - Map Matching Hooks    - ML-Based ETA Optimization
  - Telemetry Ingest   - Telemetry Compression - Dynamic Wave Tuning
```

---

## Phase Detail Specifications

### Phase 1: V1 Foundations (Current Specification)
* **Objective:** Establish reliable presence status tracking, session state machines, coordinate telemetry sampling, and wave-based fanout.
* **Core Specs:** Straight-line distance matching, default 25m/10s telemetry filters, flat capacity rules, and standard event emission models.

### Phase 2: V2 Route Intelligence & Optimization
* **Route-Aware Capacity Management:**
  * *Specification:* Move beyond flat capacity counts. Drivers can receive concurrent assignments based on route compatibility.
  * *Itinerary Calculation:* Evaluate if a proposed waypoint (pickup/dropoff) can be inserted into the driver's current route without violating SLAs for already assigned sessions.
* **Telemetry Compression (Polyline Encoding):**
  * *Specification:* Implement standard compression algorithms (e.g., Google Polyline encoding) on telemetry arrays before storing and compiling session reports, reducing storage footprint.
* **Map-Matching Integration Hooks:**
  * *Specification:* Define standard plug-in hooks where raw coordinates can be snap-aligned to road networks via routing engines before being recorded in telemetry.

### Phase 3: V3 Autonomous & Advanced Dispatch
* **Multi-Passenger Pooling Coordination:**
  * *Specification:* Coordinate complex ride-pooling sessions where multiple independent customers share a single vehicle. Motus computes optimal waypoint sequences dynamically.
* **Machine Learning Matching Scores:**
  * *Specification:* Expand the `custom` matching strategy by introducing a native ML scoring plugin that incorporates driver historical acceptance rates, traffic predictions, and weather factors to score candidates.
* **Dynamic Wave Tuning (Demand-Aware):**
  * *Specification:* Automatically adjust wave counts, candidate sizes, and timeout durations in real-time based on local supply/demand density. In high-demand zones, wave sizes decrease to prevent driver conflicts.

---

## Migration and Backwards Compatibility Policies

### Schema Versioning
* As features like route-aware waypoints are introduced, the session and event models will transition through minor versions. 
* The system must maintain schema support for at least two major versions back, transforming older payload layouts dynamically at boundary layers.

### Feature Flag Segregation
* Advanced Phase 2/3 capabilities (e.g., route-aware matching) will be configured as optional toggles within the tenant configuration model. 
* Tenants wishing to operate simple taxi or courier services can continue running the lightweight V1 engine without overhead.

---

## Future Enhancements
* **Standardized SDK Bindings:** Creating client-side libraries for mobile platforms that integrate presence heartbeats and location telemetry buffering directly with the Motus ingestion spec.
* **OSS Compliance & Validation Suite:** Building a test harness that allows open-source contributors to validate compliance of custom matching or routing plugins against the Motus core contract.
