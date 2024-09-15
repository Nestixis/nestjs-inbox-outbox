import { Inject, Injectable } from '@nestjs/common';
import { DATABASE_DRIVER_FACTORY_TOKEN, DatabaseDriverFactory } from '../driver/database-driver.factory';
import { InboxOutboxModuleEventOptions, InboxOutboxModuleOptions, MODULE_OPTIONS_TOKEN } from '../inbox-outbox.module-definition';
import { IListener } from '../listener/contract/listener.interface';
import { ListenerDuplicateNameException } from '../listener/exception/listener-duplicate-name.exception';
import { INBOX_OUTBOX_EVENT_PROCESSOR_TOKEN, InboxOutboxEventProcessorContract } from '../processor/inbox-outbox-event-processor.contract';
import { EVENT_CONFIGURATION_RESOLVER_TOKEN, EventConfigurationResolverContract } from '../resolver/event-configuration-resolver.contract';
import { InboxOutboxEvent } from './contract/inbox-outbox-event.interface';

export enum TransactionalEventEmitterOperations {
  persist = 'persist',
  remove = 'remove',
}

@Injectable()
export class TransactionalEventEmitter {
  private listeners: Map<string, IListener<any>[]> = new Map();

  constructor(
    @Inject(MODULE_OPTIONS_TOKEN) private options: InboxOutboxModuleOptions,
    @Inject(DATABASE_DRIVER_FACTORY_TOKEN) private databaseDriverFactory: DatabaseDriverFactory,
    @Inject(INBOX_OUTBOX_EVENT_PROCESSOR_TOKEN) private inboxOutboxEventProcessor: InboxOutboxEventProcessorContract,
    @Inject(EVENT_CONFIGURATION_RESOLVER_TOKEN) private eventConfigurationResolver: EventConfigurationResolverContract,
  ) {} 

  async emit(
    event: InboxOutboxEvent,
    entities: {
      operation: TransactionalEventEmitterOperations;
      entity: { id: number | string };
    }[],
  ): Promise<void> {
    const eventOptions: InboxOutboxModuleEventOptions = this.options.events.find((optionEvent) => optionEvent.name === event.name);

    if (!eventOptions) {
      throw new Error(`Event ${event.name} is not configured. Did you forget to add it to the module options?`);
    }

    const databaseDriver = this.databaseDriverFactory.create(this.eventConfigurationResolver);
    const currentTimestamp = new Date().getTime();

    const inboxOutboxTransportEvent = databaseDriver.createInboxOutboxTransportEvent(
      event.name,
      event,
      currentTimestamp + eventOptions.listeners.expiresAtTTL,
      currentTimestamp + eventOptions.listeners.readyToRetryAfterTTL,
    );

    entities.forEach((entity) => {
      if (entity.operation === 'persist') {
        databaseDriver.persist(entity.entity);
      }
      if (entity.operation === 'remove') {
        databaseDriver.remove(entity.entity);
      }
    });

    databaseDriver.persist(inboxOutboxTransportEvent);
    await databaseDriver.flush();

    return this.inboxOutboxEventProcessor.process(eventOptions, inboxOutboxTransportEvent, this.getListeners(event.name));
  }

  addListener<TPayload>(eventName: string, listener: IListener<TPayload>): void {
    const previousListeners = this.listeners.get(eventName) || [];
    if (previousListeners.some((previousListener) => previousListener.getName() === listener.getName())) {
      throw new ListenerDuplicateNameException(listener.getName());
    }
    this.listeners.set(eventName, [...previousListeners, listener]);
  }

  removeListeners(eventName: string): void {
    this.listeners.delete(eventName);
  }

  getListeners<TPayload>(eventName: string): IListener<TPayload>[] {
    return this.listeners.get(eventName) || [];
  }

  getEventNames(): string[] {
    return Array.from(this.listeners.keys());
  }
}
