export class EventDuplicateNameException extends Error {
  constructor(eventName: string) {
    super(`Event names must be unique. Duplicate name: ${eventName}`);
  }
}
