import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { MODULE_OPTIONS_TOKEN, InboxOutboxModuleOptions } from '../inbox-outbox.module-definition';
import { EventDuplicateNameException } from './exception/event-duplicate-name.exception';

@Injectable()
export class EventValidator implements OnModuleInit {
  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: InboxOutboxModuleOptions,
  ) {}

  onModuleInit() {
    const uniqueEventsNames = new Set<string>();

    for (const event of this.options.events) {
      if (uniqueEventsNames.has(event.name)) {
        throw new EventDuplicateNameException(event.name);
      }

      uniqueEventsNames.add(event.name);
    }
  }
}
