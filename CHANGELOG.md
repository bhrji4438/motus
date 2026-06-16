# Changelog

This changelog tracks major high-level releases and milestones of the Vectro platform. Detailed change histories for individual packages can be found in their respective package directories.

---

## [1.0.0] - 2026-06-16

### Added

- Complete core dispatching engine, including progressive wave offer cycles, driver locking, and state machines.
- Redis-backed spatial presence indexer, telemetry sample buffer, and event queue stream.
- Socket.IO transport adapter supporting tenant isolation, presence heartbeats, and room subscriptions.
- Notification dispatch service integrated with APNs, FCM, and OneSignal.
- Observability package including OpenTelemetry tracer hooks, Prometheus metrics registries, correlation context, and diagnostic health checks.
- Monorepo developer dashboard including Fastify server endpoints, Server-Sent Events (SSE) tracking feeds, and React real-time views.
- Testing infrastructure package with Redis container testbeds, websocket client mocks, and mutation tests.
- Rebranded public SDK package (`vectro`) supporting dynamic Redis key prefixes.

---

## Workspace Package Changelogs

For details on package-specific changes and granular patch records, see:

- **[@motus/types](packages/types/CHANGELOG.md)**
- **[@motus/core](packages/core/CHANGELOG.md)**
- **[@motus/redis](packages/redis/CHANGELOG.md)**
- **[@motus/socketio](packages/socketio/CHANGELOG.md)**
- **[@motus/notifications](packages/notifications/CHANGELOG.md)**
- **[@motus/observability](packages/observability/CHANGELOG.md)**
- **[@motus/testing](packages/testing/CHANGELOG.md)**
- **[@motus/dashboard](packages/dashboard/CHANGELOG.md)**
