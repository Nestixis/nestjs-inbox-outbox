import { Entity, PrimaryKey, Property } from '@mikro-orm/core';
import { InboxOutboxTransportEvent } from '@nestixis/nestjs-inbox-outbox';

@Entity({
  tableName: 'inbox_outbox_transport_event',
})
export class MikroOrmInboxOutboxTransportEvent implements InboxOutboxTransportEvent {
  @PrimaryKey()
  id: number;

  @Property()
  eventName: string;

  @Property({
    type: 'json',
  })
  eventPayload: any;

  @Property({
    type: 'json',
  })
  delivedToListeners: string[];

  @Property()
  readyToRetryAfter: number;

  @Property()
  expireAt: number;

  @Property()
  insertedAt: number;

  create(eventName: string, eventPayload: any, expireAt: number, readyToRetryAfter: number | null): InboxOutboxTransportEvent {
    const event = new MikroOrmInboxOutboxTransportEvent();
    event.eventName = eventName;
    event.eventPayload = eventPayload;
    event.expireAt = expireAt;
    event.readyToRetryAfter = readyToRetryAfter;
    event.insertedAt = Date.now();
    event.delivedToListeners = [];
    return event;
  }
}
