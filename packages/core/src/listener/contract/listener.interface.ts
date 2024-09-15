export interface IListener<T> {
  handle(event: T, eventName?: string): Promise<void>;

  /**
   * @description Should return a unique static name of the listener
   */
  getName(): string;
}
