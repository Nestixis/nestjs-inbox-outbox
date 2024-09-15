import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EMPTY, catchError, concatMap, from, interval, repeat } from 'rxjs';
import { DATABASE_DRIVER_FACTORY_TOKEN, DatabaseDriverFactory } from '../driver/database-driver.factory';
import { TransactionalEventEmitter } from '../emitter/transactional-event-emitter';
import { InboxOutboxModuleOptions, MODULE_OPTIONS_TOKEN } from '../inbox-outbox.module-definition';
import { InboxOutboxTransportEvent } from '../model/inbox-outbox-transport-event.interface';
import { INBOX_OUTBOX_EVENT_PROCESSOR_TOKEN, InboxOutboxEventProcessorContract } from '../processor/inbox-outbox-event-processor.contract';
import { EventConfigurationResolver } from '../resolver/event-configuration.resolver';

@Injectable()
export class RetryableInboxOutboxEventPoller implements OnModuleInit {
  constructor(
    @Inject(MODULE_OPTIONS_TOKEN) private options: InboxOutboxModuleOptions,
    @Inject(DATABASE_DRIVER_FACTORY_TOKEN) private databaseDriverFactory: DatabaseDriverFactory,
    @Inject(INBOX_OUTBOX_EVENT_PROCESSOR_TOKEN) private inboxOutboxEventProcessor: InboxOutboxEventProcessorContract,
    private transactionalEventEmitter: TransactionalEventEmitter,
    private eventConfigurationResolver: EventConfigurationResolver,
    @Inject(Logger) private logger: Logger,
  ) {}
  async onModuleInit() {
    this.logger.log(`Inbox options: retryEveryMilliseconds: ${this.options.retryEveryMilliseconds}, maxInboxOutboxTransportEventPerRetry: ${this.options.maxInboxOutboxTransportEventPerRetry}, events: ${JSON.stringify(this.options.events)}, driver: ${this.options.driverFactory.constructor.name}`);
    interval(this.options.retryEveryMilliseconds)
      .pipe(
        concatMap(() => {
          return from(this.poolRetryableEvents());
        }),
        catchError((exception) => {
          this.logger.error(exception);
          console.error(exception);
          return EMPTY;
        }),
        repeat(),
      )
      .subscribe();
  }

  async poolRetryableEvents() {
    try {
      const maxInboxOutboxTransportEventPerRetry = this.options.maxInboxOutboxTransportEventPerRetry;
      const databaseDriver = this.databaseDriverFactory.create(this.eventConfigurationResolver);

      const readyToRetryEvents = await databaseDriver.findAndExtendReadyToRetryEvents(maxInboxOutboxTransportEventPerRetry);

      if (readyToRetryEvents.length === 0) {
        return;
      }

      if (readyToRetryEvents.length > 0) {
        await this.processAsynchronousRetryableEvents(readyToRetryEvents);
      }
    } catch (exception) {
      this.logger.error(exception);
      console.error(exception);
    }
  }

  private async processAsynchronousRetryableEvents(inboxOutboxTransportEvents: InboxOutboxTransportEvent[]) {
    return Promise.allSettled(
      inboxOutboxTransportEvents.map((inboxOutboxTransportEvent) => {
        const notDeliveredToListeners = this.transactionalEventEmitter.getListeners(inboxOutboxTransportEvent.eventName).filter((listener) => {
          return !inboxOutboxTransportEvent.delivedToListeners.includes(listener.getName());
        });

        return this.inboxOutboxEventProcessor.process(
          this.options.events.find((event) => event.name === inboxOutboxTransportEvent.eventName),
          inboxOutboxTransportEvent,
          notDeliveredToListeners,
        );
      }),
    );
  }
}
