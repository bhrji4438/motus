/**
 * @motus/socketio — Real-time Socket.IO transport layer for the Motus platform.
 */

// ─── Server & Configuration ──────────────────────────────────────────────────
export { SocketServer } from "@/server/SocketServer.js";
export type { SocketIOConfig } from "@/server/SocketServer.js";

// ─── Transport Abstractions ──────────────────────────────────────────────────
export type { TransportAdapter } from "@/transport/TransportAdapter.js";
export { SocketIOTransportAdapter } from "@/transport/SocketIOTransportAdapter.js";

// ─── Authentication Contracts ────────────────────────────────────────────────
export type { IAuthenticator, AuthContext } from "@/auth/IAuthenticator.js";
export { AuthenticationManager } from "@/auth/AuthenticationManager.js";

// ─── Telemetry & Observability ────────────────────────────────────────────────
export type { ISocketMetrics } from "@/observability/ISocketMetrics.js";
export { NoopSocketMetrics } from "@/observability/ISocketMetrics.js";
export { MetricsManager } from "@/observability/MetricsManager.js";
export type { SocketObservabilityDeps } from "@/observability/MetricsManager.js";

// ─── Errors ──────────────────────────────────────────────────────────────────
export { SocketIOTransportError } from "@/errors/errors.js";
