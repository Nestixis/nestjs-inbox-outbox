import { InboxOutboxModuleEventOptions } from "../inbox-outbox.module-definition";
import { IListener } from "../listener/contract/listener.interface";
import { InboxOutboxTransportEvent } from "../model/inbox-outbox-transport-event.interface";

export const INBOX_OUTBOX_EVENT_PROCESSOR_TOKEN = 'INBOX_OUTBOX_EVENT_PROCESSOR_TOKEN';

export interface InboxOutboxEventProcessorContract {
    process<TPayload>(eventOptions: InboxOutboxModuleEventOptions, inboxOutboxTransportEvent: InboxOutboxTransportEvent, listeners: IListener<TPayload>[]): Promise<void>;
}