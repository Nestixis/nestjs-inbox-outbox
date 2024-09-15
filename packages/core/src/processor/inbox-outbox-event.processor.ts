import { Inject, Injectable, Logger } from '@nestjs/common';
import { DATABASE_DRIVER_FACTORY_TOKEN, DatabaseDriverFactory } from '../driver/database-driver.factory';
import { InboxOutboxModuleEventOptions } from '../inbox-outbox.module-definition';
import { IListener } from '../listener/contract/listener.interface';
import { InboxOutboxTransportEvent } from '../model/inbox-outbox-transport-event.interface';
import { EVENT_CONFIGURATION_RESOLVER_TOKEN, EventConfigurationResolverContract } from '../resolver/event-configuration-resolver.contract';
import { InboxOutboxEventProcessorContract } from './inbox-outbox-event-processor.contract';

@Injectable()
export class InboxOutboxEventProcessor implements InboxOutboxEventProcessorContract {
  constructor(
    @Inject(Logger) private logger: Logger,
    @Inject(DATABASE_DRIVER_FACTORY_TOKEN) private databaseDriverFactory: DatabaseDriverFactory,
    @Inject(EVENT_CONFIGURATION_RESOLVER_TOKEN) private eventConfigurationResolver: EventConfigurationResolverContract
  ) {}

  async process<TPayload>(eventOptions: InboxOutboxModuleEventOptions, inboxOutboxTransportEvent: InboxOutboxTransportEvent, listeners: IListener<TPayload>[]) {
    const deliveredToListeners: string[] = [];
    const notDeliveredToListeners: string[] = [];

    const databaseDriver = this.databaseDriverFactory.create(this.eventConfigurationResolver);

    const listenerPromises = listeners.map((listener) => this.executeListenerWithTimeout(listener, inboxOutboxTransportEvent, eventOptions));
    const listenerPromisesResults = await Promise.allSettled(listenerPromises);

    for (const result of listenerPromisesResults) {
      if (result.status === 'fulfilled' && result.value.hasFailed) {
        notDeliveredToListeners.push(result.value.listenerName);
      }

      if (result.status === 'fulfilled' && !result.value.hasFailed) {
        deliveredToListeners.push(result.value.listenerName);
      }
    }

    if (deliveredToListeners.length > 0) {
      inboxOutboxTransportEvent.delivedToListeners.push(...deliveredToListeners);
      await databaseDriver.persist(inboxOutboxTransportEvent);
    }

    if (notDeliveredToListeners.length === 0) {
      await databaseDriver.remove(inboxOutboxTransportEvent);
    }

    return databaseDriver.flush();
  }

  private executeListenerWithTimeout(
    listener: IListener<any>,
    inboxOutboxTransportEvent: InboxOutboxTransportEvent,
    eventOptions: InboxOutboxModuleEventOptions,
  ): Promise<{ listenerName: string, hasFailed: boolean }> {
    return new Promise(async (resolve, reject) => {
      let timeoutTimer: NodeJS.Timeout;

      try {
        timeoutTimer = setTimeout(() => {
          this.logger.error(`Listener ${listener.getName()} has been timed out`);
          resolve({
            listenerName: listener.getName(),
            hasFailed: true,
          });
        }, eventOptions.listeners.maxExecutionTimeTTL);

        await listener.handle(inboxOutboxTransportEvent.eventPayload, inboxOutboxTransportEvent.eventName);
        clearTimeout(timeoutTimer);

        resolve({
          listenerName: listener.getName(),
          hasFailed: false,
        });
      } catch (exception) {
        clearTimeout(timeoutTimer);
        this.logger.error(exception);
        resolve({
          listenerName: listener.getName(),
          hasFailed: true,
        });
      }
    });
  }
}
