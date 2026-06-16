export type RealtimeCallback = (payload: any) => void;

export class RealtimeClient {
  private tenantId: string;
  private wsUrl: string;
  private sseUrl: string;
  private listeners = new Map<string, Set<RealtimeCallback>>();
  private ws: WebSocket | undefined;
  private sse: EventSource | undefined;
  private activeTransport: "ws" | "sse" | "none" = "none";

  constructor(tenantId: string, host: string = window.location.host) {
    this.tenantId = tenantId;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    this.wsUrl = `${protocol}//${host}/dashboard/rt?tenantId=${tenantId}`;
    this.sseUrl = `${window.location.protocol}//${host}/api/dashboard/${tenantId}/realtime/sse`;
  }

  public getTenantId(): string {
    return this.tenantId;
  }

  /**
   * Register a callback listener for a real-time event name.
   */
  public on(event: string, callback: RealtimeCallback): void {
    const list = this.listeners.get(event) || new Set();
    list.add(callback);
    this.listeners.set(event, list);
  }

  /**
   * Remove a callback listener.
   */
  public off(event: string, callback: RealtimeCallback): void {
    const list = this.listeners.get(event);
    if (list) {
      list.delete(callback);
      if (list.size === 0) this.listeners.delete(event);
    }
  }

  /**
   * Trigger registered event callbacks.
   */
  private emit(event: string, payload: any): void {
    const list = this.listeners.get(event);
    if (list) {
      for (const cb of list) {
        try {
          cb(payload);
        } catch (err) {
          console.error(
            `Error executing realtime callback for event '${event}':`,
            err
          );
        }
      }
    }
  }

  /**
   * Connect to server, defaulting to WebSockets with automatic SSE fallback.
   */
  public connect(): void {
    this.connectWs();
  }

  private connectWs(): void {
    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onmessage = (msgEvent) => {
        try {
          const parsed = JSON.parse(msgEvent.data);
          this.activeTransport = "ws";
          if (parsed.event) {
            this.emit(parsed.event, parsed.payload);
          }
        } catch {
          // Ignore parse errors
        }
      };

      this.ws.onerror = () => {
        // Fall back immediately to SSE on connection issues
        this.fallbackToSse();
      };

      this.ws.onclose = (_event) => {
        // If it was active and closed unexpectedly, try to fall back or reconnect
        if (this.activeTransport === "none") {
          this.fallbackToSse();
        }
      };
    } catch {
      this.fallbackToSse();
    }
  }

  private fallbackToSse(): void {
    if (this.activeTransport === "ws" || this.sse) return;

    try {
      this.sse = new EventSource(this.sseUrl);
      this.activeTransport = "sse";

      // Attach listener for default event channels
      const eventNames = ["session.updated", "driver.moved", "metrics.updated"];
      eventNames.forEach((evt) => {
        this.sse?.addEventListener(evt, (e: any) => {
          try {
            const parsed = JSON.parse(e.data);
            this.emit(evt, parsed.payload);
          } catch {
            // Ignore parse errors
          }
        });
      });

      this.sse.onerror = () => {
        this.sse?.close();
        this.sse = undefined;
        this.activeTransport = "none";
        // Retry connection after 5 seconds
        setTimeout(() => this.connect(), 5000);
      };
    } catch {
      this.activeTransport = "none";
    }
  }

  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
    if (this.sse) {
      this.sse.close();
      this.sse = undefined;
    }
    this.activeTransport = "none";
  }

  public getActiveTransport(): "ws" | "sse" | "none" {
    return this.activeTransport;
  }
}
