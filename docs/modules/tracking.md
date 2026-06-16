# Tracking Module

## 1. Overview

The Tracking Module is responsible for ingesting live GPS coordinate feeds, sampling locations to filter jitter and stationary noise, caching real-time coordinates, and compiling compressed historical paths for route replay.

## 2. Business Problem Solved

Ingesting every raw GPS ping (often 1Hz) from driver devices quickly saturates backend databases, generates redundant data when drivers are stuck in traffic, and exhausts network bandwidth. The Tracking Module solves this by sampling coordinate changes on the server side and compressing coordinates into polylines for storage efficiency.

## 3. Features

- High-frequency GPS signal ingestion.
- Spatial-temporal telemetry sampling filter (minimum 10 seconds or 25 meters delta).
- Live coordinates Pub/Sub routing.
- Google Encoded Polyline path compression.
- Historical route replay generation.

## 4. Architecture Diagram

```mermaid
flowchart LR
    DriverApp[Driver Client] -->|WebSocket: updateDriverLocation| Express[@motus/socketio]
    Express -->|Ingest Raw Point| Sampler[Telemetry Sampler]
    Sampler -->|Meets Threshold| RedisStream[(Redis Telemetry Stream)]
    Sampler -->|Broadcast| PubSub((Redis Pub/Sub Channel))
    PubSub -->|Stream Broadcast| PassengerRoom[Passenger Session Room]
```

## 5. End-to-End Business Flow

1.  Driver client streams location heartbeats via WS to `@motus/socketio`.
2.  The gateway invokes the `updateDriverLocation` command on `DriverNamespace`.
3.  `TelemetrySampler` compares the point to the driver's last stored coordinate.
4.  If the coordinate is older than 10 seconds or further than 25 meters, it is appended to the session's Redis Telemetry Stream.
5.  The location is published to the session's Pub/Sub tracking room, broadcasting it to clients.
6.  When the session completes, the telemetry stream is collected, encoded into a Polyline, and archived.

## 6. Core Components

- `TelemetryManager`: Orchestrates ingestion operations and maps inputs to builders.
- `TelemetrySampler`: Class checking time and distance thresholds.
- `PolylineEncoder`: Utilities translating coordinates to standard polyline string models.

## 7. Public APIs

- `vectro.driver.updateDriverLocation(command: UpdateDriverLocationCommand): Promise<void>`
  - **Parameters**: `command` (tenantId, driverId, latitude, longitude, timestamp, bearing, speed, accuracy)
  - **Returns**: `void`
  - **Errors**: `InvalidCoordinateError` (if lat/lng is out of bounds).

## 8. Events

- `telemetry.sampled`: Emitted when a coordinate meets the threshold and is saved to the session.
  - **Payload**: `{ tenantId, sessionId, location: { latitude, longitude, bearing, speed } }`

## 9. Data Models

```typescript
interface LocationCoordinate {
  latitude: number;
  longitude: number;
  accuracy?: number;
  bearing?: number;
  speed?: number;
  timestamp: string;
}
```

## 10. Storage Design

- **Location Hash**: `tenant:{tenantId}:driver:{driverId}`
- **Telemetry Stream**: `tenant:{tenantId}:session:{sessionId}:telemetry`
  - _Data Structure_: Redis Stream (XADD)
  - _TTL_: 24 Hours

## 11. Configuration

```typescript
interface TelemetryConfig {
  sampleDistanceMeters: number; // Default: 25
  sampleIntervalSeconds: number; // Default: 10
  streamTtlSeconds: number; // Default: 86400 (24 hours)
}
```

## 12. Integration Guide

1. Import `createVectro` and configure the telemetry thresholds.
2. Hook your socket server up to forward coordinates using `updateDriverLocation`.

## 13. Step-by-Step Implementation Guide

```typescript
// Forward incoming GPS update from client connection
socket.on("location_update", async (data) => {
  await vectro.driver.updateDriverLocation({
    tenantId: socket.tenantId,
    driverId: socket.driverId,
    latitude: data.lat,
    longitude: data.lng,
    bearing: data.bearing,
    speed: data.speed,
    accuracy: data.accuracy,
    timestamp: new Date().toISOString()
  });
});
```

## 14. Extension Guide

To substitute polyline compression with an alternative compression scheme (e.g. gzip-json), override the `Serializer` in `@motus/redis`.

## 15. Scaling Considerations

When scaling to 100k+ active drivers:

- Enforce Redis Cluster partitioning using `{tenantId}` hash tags to distribute geo set keys.
- Enforce memory boundaries using 24-hour Stream TTLs.

## 16. Troubleshooting

- **GPS Jump Drift**: If GPS jumps, it can trigger incorrect geofences. Filter coordinates with high inaccuracy markers ($\ge 50\text{m}$).
- **Stale Drivers**: If locations don't expire, verify presence pruner workers are running.

## 17. Examples

```typescript
// Compressing a set of coordinates into a Polyline string
import { encodePolyline } from "@motus/core";

const polylineStr = encodePolyline([
  { latitude: 38.5, longitude: -120.2 },
  { latitude: 40.7, longitude: -120.9 },
]);
// Returns "_p~iF~ps|U_ulLnnqC"
```
