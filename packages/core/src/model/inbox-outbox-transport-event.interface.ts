export interface InboxOutboxTransportEvent {
  id: number;
  eventName: string;
  eventPayload: any;
  delivedToListeners: string[];
  readyToRetryAfter: number | null;
  expireAt: number;
  insertedAt: number;
}
