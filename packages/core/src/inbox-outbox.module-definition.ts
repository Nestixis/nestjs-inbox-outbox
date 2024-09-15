import { ConfigurableModuleBuilder } from '@nestjs/common';
import { DatabaseDriverFactory } from './driver/database-driver.factory';

export interface InboxOutboxModuleEventOptions {
  name: string;
  listeners: {
    expiresAtTTL: number;
    readyToRetryAfterTTL: number;
    maxExecutionTimeTTL: number;
  };
}

export interface InboxOutboxModuleOptions {
  events: InboxOutboxModuleEventOptions[];
  retryEveryMilliseconds: number;
  maxInboxOutboxTransportEventPerRetry: number;
  driverFactory: DatabaseDriverFactory;
}

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, ASYNC_OPTIONS_TYPE } = new ConfigurableModuleBuilder<InboxOutboxModuleOptions>()
  .setExtras(
    {
      isGlobal: true,
    },
    (definition, extras) => ({
      ...definition,
      global: extras.isGlobal,
    }),
  )
  .build();
