export class ListenerDuplicateNameException extends Error {
  constructor(listenerName: string) {
    super(`Listener ${listenerName} is already registered`);
  }
}
