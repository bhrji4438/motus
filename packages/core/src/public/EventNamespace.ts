import { EventNamespace as IEventNamespace, MotusEvent } from "@motus/types";

export class EventNamespace implements IEventNamespace {
  private dispatcher: any;

  public setDependencies(dispatcher: any): void {
    this.dispatcher = dispatcher;
  }

  public on<T extends MotusEvent["eventName"]>(
    eventPattern: T | string,
    handler: (
      event: Extract<MotusEvent, { readonly eventName: T }> | any
    ) => void | Promise<void>
  ): void {
    if (this.dispatcher) {
      this.dispatcher.on(eventPattern, handler);
    }
  }

  public off<T extends MotusEvent["eventName"]>(
    eventPattern: T | string,
    handler: (
      event: Extract<MotusEvent, { readonly eventName: T }> | any
    ) => void | Promise<void>
  ): void {
    if (this.dispatcher) {
      this.dispatcher.off(eventPattern, handler);
    }
  }

  public once<T extends MotusEvent["eventName"]>(
    eventPattern: T | string,
    handler: (
      event: Extract<MotusEvent, { readonly eventName: T }> | any
    ) => void | Promise<void>
  ): void {
    if (this.dispatcher) {
      this.dispatcher.once(eventPattern, handler);
    }
  }
}
