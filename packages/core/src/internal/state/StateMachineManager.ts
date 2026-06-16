import { DriverStatus, SessionState } from '@motus/types';
import { ErrorFactory } from '@/internal/errors/ErrorFactory.js';

export class StateMachineManager {
  private static readonly VALID_DRIVER_TRANSITIONS: Record<DriverStatus, readonly DriverStatus[]> = {
    [DriverStatus.OFFLINE]: [DriverStatus.ONLINE],
    [DriverStatus.ONLINE]: [DriverStatus.BUSY, DriverStatus.PAUSED, DriverStatus.STALE, DriverStatus.OFFLINE],
    [DriverStatus.BUSY]: [DriverStatus.ONLINE, DriverStatus.STALE, DriverStatus.OFFLINE],
    [DriverStatus.PAUSED]: [DriverStatus.ONLINE, DriverStatus.STALE, DriverStatus.OFFLINE],
    [DriverStatus.STALE]: [DriverStatus.ONLINE, DriverStatus.BUSY, DriverStatus.PAUSED, DriverStatus.OFFLINE]
  };

  private static readonly VALID_SESSION_TRANSITIONS: Record<SessionState, readonly SessionState[]> = {
    [SessionState.CREATED]: [SessionState.SEARCHING],
    [SessionState.SEARCHING]: [SessionState.DRIVER_ASSIGNED, SessionState.CANCELLED],
    [SessionState.DRIVER_ASSIGNED]: [SessionState.DRIVER_EN_ROUTE, SessionState.SEARCHING, SessionState.DRIVER_LOST, SessionState.CANCELLED],
    [SessionState.DRIVER_EN_ROUTE]: [SessionState.ARRIVED, SessionState.DRIVER_LOST, SessionState.SEARCHING, SessionState.CANCELLED],
    [SessionState.ARRIVED]: [SessionState.IN_PROGRESS, SessionState.DRIVER_LOST, SessionState.SEARCHING, SessionState.CANCELLED],
    [SessionState.IN_PROGRESS]: [SessionState.COMPLETED, SessionState.DRIVER_LOST, SessionState.CANCELLED],
    [SessionState.DRIVER_LOST]: [
      SessionState.DRIVER_ASSIGNED,
      SessionState.DRIVER_EN_ROUTE,
      SessionState.ARRIVED,
      SessionState.IN_PROGRESS,
      SessionState.SEARCHING
    ],
    [SessionState.COMPLETED]: [],
    [SessionState.CANCELLED]: []
  };

  /**
   * Validates and returns the target state for a driver presence transition.
   * Throws a MotusCoreError if the transition is prohibited by state machine or guards.
   */
  public validateDriverTransition(
    current: DriverStatus,
    target: DriverStatus,
    context: { currentLoad: number; capacity: number }
  ): void {
    if (current === target) {
      return; // No-op transition is allowed
    }

    const allowed = StateMachineManager.VALID_DRIVER_TRANSITIONS[current];
    if (!allowed.includes(target)) {
      throw ErrorFactory.invalidTransition(current, target, `Prohibited transition in driver state machine.`);
    }

    // Guard: Online/Busy to Paused requires currentLoad == 0
    if (target === DriverStatus.PAUSED && context.currentLoad > 0) {
      throw ErrorFactory.invalidTransition(
        current,
        target,
        `Cannot pause a driver who has active assignments (load: ${context.currentLoad}/${context.capacity}).`
      );
    }

    // Guard: Online to Busy is allowed if currentLoad >= capacity (or if capacity reached)
    // online -> online is also allowed (this is a self-transition or is handled outside when currentLoad < capacity)
  }

  /**
   * Validates and returns the target state for a dispatch session transition.
   * Throws a MotusCoreError if the transition is prohibited.
   */
  public validateSessionTransition(
    current: SessionState,
    target: SessionState,
    context?: { previousState?: SessionState }
  ): void {
    if (current === target) {
      return; // No-op transition is allowed
    }

    // Guard: Terminal state mutation protection
    if (current === SessionState.COMPLETED || current === SessionState.CANCELLED) {
      throw ErrorFactory.invalidTransition(
        current,
        target,
        `Terminal state ${current} is immutable and cannot transition further.`
      );
    }

    const allowed = StateMachineManager.VALID_SESSION_TRANSITIONS[current];
    if (!allowed.includes(target)) {
      throw ErrorFactory.invalidTransition(current, target, `Prohibited transition in session state machine.`);
    }

    // Guard: When recovering from DRIVER_LOST, we must transition back to the correct previous state
    if (current === SessionState.DRIVER_LOST && target !== SessionState.SEARCHING) {
      if (context && context.previousState && target !== context.previousState) {
        throw ErrorFactory.invalidTransition(
          current,
          target,
          `Cannot recover session to state ${target}. Must restore to stashed previous state ${context.previousState}.`
        );
      }
    }
  }
}
