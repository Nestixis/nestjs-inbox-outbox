import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { TransactionalEventEmitter } from '../../emitter/transactional-event-emitter';
import { IListener } from '../contract/listener.interface';
import { REGISTRY_METADATA_KEY } from './listener.registry';
import { ListenerDuplicateNameException } from '../exception/listener-duplicate-name.exception';

@Injectable()
export class ListenerDiscovery implements OnModuleInit {
  constructor(
    private readonly transactionalEventEmitter: TransactionalEventEmitter,
    @Inject(DiscoveryService) private discoveryService: DiscoveryService,
    @Inject(Logger) private logger: Logger,
  ) {}

  isListener(target: any): target is IListener<any> {
    return target && typeof target.handle === 'function';
  }

  onModuleInit() {
    const listenerProvidersWrappers = this.discoveryService.getProviders();

    const listeners = listenerProvidersWrappers.filter((provider) => provider.metatype && Reflect.getMetadata(REGISTRY_METADATA_KEY, provider.metatype));

    const listenerUniqueNames = new Set<string>();

    for (const listener of listeners) {
      if (!this.isListener(listener.instance)) {
        continue;
      }

      const listenerName = listener.instance.getName();

      if (listenerUniqueNames.has(listenerName)) {
        throw new ListenerDuplicateNameException(listenerName);
      }

      listenerUniqueNames.add(listenerName);

      const eventsNames = Reflect.getMetadata(REGISTRY_METADATA_KEY, listener.metatype);

      if (Array.isArray(eventsNames)) {
        eventsNames.forEach((eventName) => {
          this.transactionalEventEmitter.addListener(eventName, listener.instance);
          this.logger.log(`Listener ${listener.metatype.name} has been registered for inbox outbox event ${eventName}`);
        });
      }

      if (!Array.isArray(eventsNames)) {
        this.transactionalEventEmitter.addListener(eventsNames, listener.instance);
        this.logger.log(`Listener ${listener.metatype.name} has been registered for inbox outbox event ${eventsNames}`);
      }
    }
  }
}
