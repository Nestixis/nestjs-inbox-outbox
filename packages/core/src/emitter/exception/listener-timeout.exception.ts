export class ListenerTimeoutException extends Error {
  constructor(listenerName: string) {
    super(`Listener timeout: ${listenerName}`);
  }
}
