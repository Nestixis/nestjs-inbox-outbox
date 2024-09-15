import { InboxOutboxModuleEventOptions } from "../inbox-outbox.module-definition";

export const EVENT_CONFIGURATION_RESOLVER_TOKEN = 'EVENT_CONFIGURATION_RESOLVER_TOKEN';

export interface EventConfigurationResolverContract {
    resolve(eventName: string): InboxOutboxModuleEventOptions;
}