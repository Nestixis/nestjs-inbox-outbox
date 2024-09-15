import { DatabaseDriverFactory } from '../../driver/database-driver.factory';
import { DatabaseDriver } from '../../driver/database.driver';
import { TransactionalEventEmitter, TransactionalEventEmitterOperations } from '../../emitter/transactional-event-emitter';
import { InboxOutboxModuleOptions } from '../../inbox-outbox.module-definition';
import { IListener } from '../../listener/contract/listener.interface';
import { InboxOutboxEventProcessorContract } from '../../processor/inbox-outbox-event-processor.contract';
import { EventConfigurationResolverContract } from '../../resolver/event-configuration-resolver.contract';
import { createMockedDriverFactory } from './mock/driver-factory.mock';
import { createMockedDriver } from './mock/driver.mock';
import { createMockedEventConfigurationResolver } from './mock/event-configuration-resolver.mock';
import { createMockedInboxOutboxEventProcessor } from './mock/inbox-outbox-event-processor.mock';
import { createMockedInboxOutboxOptionsFactory } from './mock/inbox-outbox-options.mock';

describe('TransacationalEventEmitter', () => {

  let mockedDriver: DatabaseDriver;
  let mockedDriverFactory: DatabaseDriverFactory;
  let inboxOutboxOptions: InboxOutboxModuleOptions;
  let mockedInboxOutboxEventProcessor: InboxOutboxEventProcessorContract;
  let mockedEventConfigurationResolver: EventConfigurationResolverContract;

  beforeEach(() => {
    mockedDriver = createMockedDriver();
    mockedDriverFactory = createMockedDriverFactory(mockedDriver);
    inboxOutboxOptions = createMockedInboxOutboxOptionsFactory(mockedDriverFactory, []);
    mockedInboxOutboxEventProcessor = createMockedInboxOutboxEventProcessor();
    mockedEventConfigurationResolver = createMockedEventConfigurationResolver();
  });

  it('Should call persist 2 times and flush', async () => {

    inboxOutboxOptions.events = [
      {
        name: 'newEvent',
        listeners: {
          expiresAtTTL: 1000,
          readyToRetryAfterTTL: 1000,
          maxExecutionTimeTTL: 1000,
        },
      },
    ];

    const transactionalEventEmitter = new TransactionalEventEmitter(inboxOutboxOptions, mockedDriverFactory, mockedInboxOutboxEventProcessor, mockedEventConfigurationResolver);

    const newEvent = {
      name: 'newEvent',
    };

    const newEntityToSave = {
      id: null,
    };

    await transactionalEventEmitter.emit(newEvent, [
      {
        entity: newEntityToSave,
        operation: TransactionalEventEmitterOperations.persist,
      },
    ]);

    expect(mockedDriver.persist).toHaveBeenCalledWith(newEntityToSave);
    expect(mockedDriver.persist).toHaveBeenCalledTimes(2);
    expect(mockedDriver.flush).toHaveBeenCalled();
  });

  it('Should call remove 1 times and flush', async () => {

    inboxOutboxOptions.events = [
      {
        name: 'newEvent',
        listeners: {
          expiresAtTTL: 1000,
          readyToRetryAfterTTL: 1000,
          maxExecutionTimeTTL: 1000,
        },
      },
    ];

    const transactionalEventEmitter = new TransactionalEventEmitter(inboxOutboxOptions, mockedDriverFactory, mockedInboxOutboxEventProcessor, mockedEventConfigurationResolver);

    const newEvent = {
      name: 'newEvent',
    };

    const newEntityToRemove = {
      id: null,
    };

    await transactionalEventEmitter.emit(newEvent, [
      {
        entity: newEntityToRemove,
        operation: TransactionalEventEmitterOperations.remove,
      },
    ]);

    expect(mockedDriver.remove).toHaveBeenCalledWith(newEntityToRemove);
    expect(mockedDriver.remove).toHaveBeenCalledTimes(1);
    expect(mockedDriver.flush).toHaveBeenCalled();
  });

  it('Should call persist 3 times and flush', async () => {

    inboxOutboxOptions.events = [
      {
        name: 'newEvent',
        listeners: {
          expiresAtTTL: 1000,
          readyToRetryAfterTTL: 1000,
          maxExecutionTimeTTL: 1000,
        },
      },
    ];

    const transactionalEventEmitter = new TransactionalEventEmitter(inboxOutboxOptions, mockedDriverFactory, mockedInboxOutboxEventProcessor, mockedEventConfigurationResolver);

    const newEvent = {
      name: 'newEvent',
    };

    const newEntityToSave = {
      id: null,
    };

    await transactionalEventEmitter.emit(newEvent, [
      {
        entity: newEntityToSave,
        operation: TransactionalEventEmitterOperations.persist,
      },
      {
        entity: newEntityToSave,
        operation: TransactionalEventEmitterOperations.persist,
      },
    ]);

    expect(mockedDriver.persist).toHaveBeenCalledTimes(3);
    expect(mockedDriver.flush).toHaveBeenCalled();
  });

  it('Should call persist 1 times and flush', async () => {

    inboxOutboxOptions.events = [
      {
        name: 'newEvent',
        listeners: {
          expiresAtTTL: 1000,
          readyToRetryAfterTTL: 1000,
          maxExecutionTimeTTL: 1000,
        },
      },
    ];

    const transactionalEventEmitter = new TransactionalEventEmitter(inboxOutboxOptions, mockedDriverFactory, mockedInboxOutboxEventProcessor, mockedEventConfigurationResolver);

    const newEvent = {
      name: 'newEvent',
    };
    
    await transactionalEventEmitter.emit(newEvent, []);

    expect(mockedDriver.persist).toHaveBeenCalledTimes(1);
    expect(mockedDriver.flush).toHaveBeenCalled();
  });

  it('Should call process one time on inboxOutboxEventProcessor', async () => {

    inboxOutboxOptions.events = [
      {
        name: 'newEvent',
        listeners: {
          expiresAtTTL: 1000,
          readyToRetryAfterTTL: 1000,
          maxExecutionTimeTTL: 1000,
        },
      },
    ];
  
    const transactionalEventEmitter = new TransactionalEventEmitter(inboxOutboxOptions, mockedDriverFactory, mockedInboxOutboxEventProcessor, mockedEventConfigurationResolver);

    inboxOutboxOptions = createMockedInboxOutboxOptionsFactory(mockedDriverFactory, [
      {
        name: 'newEvent',
        listeners: {
          expiresAtTTL: 1000,
          readyToRetryAfterTTL: 1000,
          maxExecutionTimeTTL: 1000,
        },
      },
    ]);

    const newEvent = {
      name: 'newEvent',
    };

    const newEntityToSave = {
      id: null,
    };

    await transactionalEventEmitter.emit(newEvent, [
      {
        entity: newEntityToSave,
        operation: TransactionalEventEmitterOperations.persist,
      },
    ]);

    expect(mockedInboxOutboxEventProcessor.process).toHaveBeenCalledTimes(1);
  });

  it('Should throw an error when event is not configured', async () => {
    const transactionalEventEmitter = new TransactionalEventEmitter(inboxOutboxOptions, mockedDriverFactory, mockedInboxOutboxEventProcessor, mockedEventConfigurationResolver);

    const newEvent = {
      name: 'notConfiguredEvent',
    };

    await expect(transactionalEventEmitter.emit(newEvent, [])).rejects.toThrow(`Event ${newEvent.name} is not configured. Did you forget to add it to the module options?`);
  })


  it('Should throw an error when listener has duplicate name', async () => {
    const transactionalEventEmitter = new TransactionalEventEmitter(inboxOutboxOptions, mockedDriverFactory, mockedInboxOutboxEventProcessor, mockedEventConfigurationResolver);

    const listener : IListener<any> = {
      getName: () => {
        return 'listenerName';
      },
      handle: async () => {
        return;
      }
    };

    transactionalEventEmitter.addListener('eventName', listener);

    expect(() => transactionalEventEmitter.addListener('eventName', listener)).toThrow(`Listener ${listener.getName()} is already registered`);
  });

  it('Should add listener', async () => {
    const transactionalEventEmitter = new TransactionalEventEmitter(inboxOutboxOptions, mockedDriverFactory, mockedInboxOutboxEventProcessor, mockedEventConfigurationResolver);

    const listener : IListener<any> = {
      getName: () => {
        return 'listenerName';
      },
      handle: async () => {
        return;
      }
    };

    transactionalEventEmitter.addListener('eventName', listener);

    expect(transactionalEventEmitter.getListeners('eventName')).toContain(listener);
  });
  

  it('Should remove listener', async () => {
    const transactionalEventEmitter = new TransactionalEventEmitter(inboxOutboxOptions, mockedDriverFactory, mockedInboxOutboxEventProcessor, mockedEventConfigurationResolver);

    const listener : IListener<any> = {
      getName: () => {
        return 'listenerName';
      },
      handle: async () => {
        return;
      }
    };

    transactionalEventEmitter.addListener('eventName', listener);

    transactionalEventEmitter.removeListeners('eventName');

    expect(transactionalEventEmitter.getListeners('eventName')).toEqual([]);
  })

  it('Should get event names', async () => {
    const transactionalEventEmitter = new TransactionalEventEmitter(inboxOutboxOptions, mockedDriverFactory, mockedInboxOutboxEventProcessor, mockedEventConfigurationResolver);

    const listener : IListener<any> = {
      getName: () => {
        return 'listenerName';
      },
      handle: async () => {
        return;
      }
    };

    transactionalEventEmitter.addListener('eventName', listener);

    expect(transactionalEventEmitter.getEventNames()).toContain('eventName');
  })
});
