import { DynamicModule, Logger, Module, Provider } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { DATABASE_DRIVER_FACTORY_TOKEN, DatabaseDriverFactory } from './driver/database-driver.factory';
import { TransactionalEventEmitter } from './emitter/transactional-event-emitter';
import { EventValidator } from './event-validator/event.validator';
import { ASYNC_OPTIONS_TYPE, ConfigurableModuleClass, InboxOutboxModuleOptions, MODULE_OPTIONS_TOKEN } from './inbox-outbox.module-definition';
import { ListenerDiscovery } from './listener/discovery/listener.discovery';
import { RetryableInboxOutboxEventPoller } from './poller/retryable-inbox-outbox-event.poller';
import { INBOX_OUTBOX_EVENT_PROCESSOR_TOKEN } from './processor/inbox-outbox-event-processor.contract';
import { InboxOutboxEventProcessor } from './processor/inbox-outbox-event.processor';
import { EVENT_CONFIGURATION_RESOLVER_TOKEN } from './resolver/event-configuration-resolver.contract';
import { EventConfigurationResolver } from './resolver/event-configuration.resolver';

@Module({
  imports: [DiscoveryModule],
  providers: [
    Logger,
    {
      provide: INBOX_OUTBOX_EVENT_PROCESSOR_TOKEN,
      useFactory: (logger: Logger, databaseDriverFactory: DatabaseDriverFactory, eventConfigurationResolver: EventConfigurationResolver) => {
        return new InboxOutboxEventProcessor(logger, databaseDriverFactory, eventConfigurationResolver);
      },
      inject: [Logger, DATABASE_DRIVER_FACTORY_TOKEN, EventConfigurationResolver],
    },
    {
      provide: EVENT_CONFIGURATION_RESOLVER_TOKEN,
      useFactory: (options: InboxOutboxModuleOptions) => {
        return new EventConfigurationResolver(options);
      },
      inject: [MODULE_OPTIONS_TOKEN],
    },
    TransactionalEventEmitter,
    RetryableInboxOutboxEventPoller,
    ListenerDiscovery,
    EventConfigurationResolver,
    EventValidator,
  ],
})
export class InboxOutboxModule extends ConfigurableModuleClass {
  static registerAsync(options: typeof ASYNC_OPTIONS_TYPE): DynamicModule {
    const registered = super.registerAsync(options);

    return {
      ...registered,
      global: options.isGlobal,
      imports: [...registered.imports],
      providers: [
        ...registered.providers,
        {
          provide: DATABASE_DRIVER_FACTORY_TOKEN,
          useFactory: async (options: InboxOutboxModuleOptions) => {
            return options.driverFactory;
          },
          inject: [MODULE_OPTIONS_TOKEN],
        } as Provider<any>,
      ],
      exports: [TransactionalEventEmitter],
    };
  }
}
