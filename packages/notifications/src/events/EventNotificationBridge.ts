import {
  MotusEvent,
  SessionAssignedEvent,
  DispatchWaveStartedEvent,
} from "@motus/types";
import { NotificationService } from "@/services/NotificationService.js";

export class EventNotificationBridge {
  private notificationService: NotificationService;

  constructor(notificationService: NotificationService) {
    this.notificationService = notificationService;
  }

  /**
   * Listen and map a canonical MotusEvent to a push notification.
   */
  public async handleEvent(event: MotusEvent): Promise<void> {
    const tenantId = event.payload.tenantId;

    switch (event.eventName) {
      case "session.assigned": {
        const assignedEvent = event as SessionAssignedEvent;
        const payload = assignedEvent.payload;

        await this.notificationService.sendWithTemplate(
          tenantId,
          payload.assignedDriverId,
          "session_assigned",
          {
            sessionId: payload.sessionId,
            estimatedDuration: payload.estimatedDurationSeconds.toString(),
          }
        );
        break;
      }

      case "dispatch.wave.started": {
        const waveEvent = event as DispatchWaveStartedEvent;
        const payload = waveEvent.payload;

        // Broadcast to all candidates in the dispatch wave
        await Promise.all(
          payload.candidates.map((candidateId) =>
            this.notificationService.sendWithTemplate(
              tenantId,
              candidateId,
              "wave_started",
              {
                sessionId: payload.sessionId,
                waveNumber: payload.waveNumber.toString(),
                expiresAt: payload.expiresAt,
              }
            )
          )
        );
        break;
      }

      default:
        // Other events can be ignored or custom mappings added
        break;
    }
  }
}
