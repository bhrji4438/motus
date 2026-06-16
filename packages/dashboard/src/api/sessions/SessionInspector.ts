export interface TraceSpanData {
  spanId: string;
  traceId: string;
  name: string;
  startTimeUnixNano: number;
  durationMs: number;
  attributes: Record<string, string>;
  error?: string;
}

export class SessionInspector {
  // Mock store for demonstration & testing
  private mockSessions = new Map<string, any>();

  constructor() {
    // Register a mock session for the default view
    this.mockSessions.set("S100", {
      id: "S100",
      tenantId: "T1",
      status: "IN_PROGRESS",
      pickupPoint: {
        latitude: 37.7749,
        longitude: -122.4194,
        timestamp: new Date().toISOString(),
      },
      destinationPoint: {
        latitude: 37.7891,
        longitude: -122.4014,
        timestamp: new Date().toISOString(),
      },
      telemetryPath: [
        {
          latitude: 37.7749,
          longitude: -122.4194,
          timestamp: new Date().toISOString(),
        },
        {
          latitude: 37.7794,
          longitude: -122.4132,
          timestamp: new Date().toISOString(),
        },
        {
          latitude: 37.7842,
          longitude: -122.4081,
          timestamp: new Date().toISOString(),
        },
      ],
      eventTimeline: [
        {
          eventId: "ev-1",
          eventName: "session.created",
          timestamp: new Date().toISOString(),
          payload: {},
        },
        {
          eventId: "ev-2",
          eventName: "dispatch.wave.started",
          timestamp: new Date().toISOString(),
          payload: { waveNumber: 1 },
        },
        {
          eventId: "ev-3",
          eventName: "session.assigned",
          timestamp: new Date().toISOString(),
          payload: { assignedDriverId: "driver-1" },
        },
      ],
      traces: [
        {
          spanId: "span-1",
          traceId: "trace-100",
          name: "POST /tenants/T1/sessions",
          startTimeUnixNano: Date.now() * 1000000 - 5000000000,
          durationMs: 42,
          attributes: { "http.status_code": "201", "db.system": "redis" },
        },
        {
          spanId: "span-2",
          traceId: "trace-100",
          name: "MatchingEngine.scoreCandidates",
          startTimeUnixNano: Date.now() * 1000000 - 4500000000,
          durationMs: 125,
          attributes: { "db.system": "redis", "db.operation": "lua" },
        },
        {
          spanId: "span-3",
          traceId: "trace-100",
          name: "APNS.send",
          startTimeUnixNano: Date.now() * 1000000 - 3200000000,
          durationMs: 82,
          attributes: { "messaging.system": "apns" },
        },
      ] as TraceSpanData[],
    });
  }

  /**
   * List all sessions within a tenant.
   */
  public async listSessions(tenantId: string, status?: string): Promise<any[]> {
    return Array.from(this.mockSessions.values()).filter(
      (s) => s.tenantId === tenantId && (!status || s.status === status)
    );
  }

  /**
   * Get detail and paths for a single session.
   */
  public async getSessionDetail(
    tenantId: string,
    sessionId: string
  ): Promise<any | null> {
    const session = this.mockSessions.get(sessionId);
    if (session && session.tenantId === tenantId) {
      return session;
    }
    return null;
  }

  /**
   * Expose OTel-compatible trace span data for a session to draw in the TraceVisualizer.
   */
  public async getSessionTraces(
    tenantId: string,
    sessionId: string
  ): Promise<TraceSpanData[]> {
    const session = await this.getSessionDetail(tenantId, sessionId);
    return session ? session.traces : [];
  }
}

// Global default session inspector
export const defaultSessionInspector = new SessionInspector();
export default defaultSessionInspector;
