import { DriverId, TenantId, DriverNamespace } from "@motus/types";
import { MetricsManager } from "@/observability/MetricsManager.js";

export class FailureRecoveryManager {
  private readonly disconnectTimers = new Map<string, NodeJS.Timeout>();
  private readonly offlineEventBuffer: {
    room: string;
    event: string;
    payload: any;
    expiresAt: number;
  }[] = [];

  constructor(
    private readonly driverNamespace: DriverNamespace,
    private readonly metrics: MetricsManager,
    private readonly disconnectGraceSeconds: number = 30
  ) {}

  /**
   * Tracks a driver socket disconnect. Starts a grace timer before marking the driver offline.
   */
  public handleDriverDisconnect(
    tenantId: TenantId,
    driverId: DriverId,
    socketId: string
  ): void {
    const key = `${tenantId}:${driverId}`;

    if (this.disconnectTimers.has(key)) {
      clearTimeout(this.disconnectTimers.get(key)!);
    }

    const timer = setTimeout(async () => {
      this.disconnectTimers.delete(key);
      this.metrics.logger.warn(
        `Driver grace period expired. Transitioning presence to OFFLINE.`,
        {
          tenantId,
          driverId,
        }
      );

      try {
        await this.driverNamespace.setDriverOffline(tenantId, driverId);
      } catch (err) {
        this.metrics.logger.error(
          `Failed to set driver presence offline after disconnect.`,
          err
        );
        this.metrics.metrics.recordSocketError(
          tenantId,
          "PRESENCE_TRANSITION_FAILED"
        );
      }
    }, this.disconnectGraceSeconds * 1000);

    this.disconnectTimers.set(key, timer);
    this.metrics.logger.info(
      `Driver disconnected. Offline grace timer started (${this.disconnectGraceSeconds}s).`,
      {
        socketId,
        driverId,
      }
    );
  }

  /**
   * Cancels any pending offline grace timers if a driver reconnects.
   */
  public handleDriverReconnect(
    tenantId: TenantId,
    driverId: DriverId
  ): boolean {
    const key = `${tenantId}:${driverId}`;
    const timer = this.disconnectTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.disconnectTimers.delete(key);
      this.metrics.logger.info(
        `Driver reconnected before grace period expired. Offline timer cancelled.`,
        {
          driverId,
        }
      );
      return true;
    }
    return false;
  }

  /**
   * Buffers critical outgoing events if Redis is down.
   */
  public bufferOutgoingEvent(
    room: string,
    event: string,
    payload: any,
    ttlMs: number = 10000
  ): void {
    this.offlineEventBuffer.push({
      room,
      event,
      payload,
      expiresAt: Date.now() + ttlMs,
    });
    this.metrics.logger.warn(`Redis down. Event buffered.`, { room, event });

    // Clean up expired buffered events
    this.cleanupExpiredBuffer();
  }

  public getBufferedEvents(): { room: string; event: string; payload: any }[] {
    this.cleanupExpiredBuffer();
    return this.offlineEventBuffer.map((b) => ({
      room: b.room,
      event: b.event,
      payload: b.payload,
    }));
  }

  public clearBuffer(): void {
    this.offlineEventBuffer.length = 0;
  }

  private cleanupExpiredBuffer(): void {
    const now = Date.now();
    let i = this.offlineEventBuffer.length;
    while (i--) {
      if (this.offlineEventBuffer[i].expiresAt < now) {
        this.offlineEventBuffer.splice(i, 1);
      }
    }
  }

  public cleanup(): void {
    for (const timer of this.disconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.disconnectTimers.clear();
    this.clearBuffer();
  }
}
