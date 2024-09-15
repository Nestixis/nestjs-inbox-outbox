import { DatabaseDriverFactory } from "../../driver/database-driver.factory";
import { DatabaseDriver } from "../../driver/database.driver";
import { InboxOutboxModuleOptions } from "../../inbox-outbox.module-definition";
import { IListener } from "../../listener/contract/listener.interface";
import { InboxOutboxTransportEvent } from "../../model/inbox-outbox-transport-event.interface";
import { InboxOutboxEventProcessorContract } from "../../processor/inbox-outbox-event-processor.contract";
import { InboxOutboxEventProcessor } from "../../processor/inbox-outbox-event.processor";
import { EventConfigurationResolverContract } from "../../resolver/event-configuration-resolver.contract";
import { createMockedDriverFactory } from "./mock/driver-factory.mock";
import { createMockedDriver } from "./mock/driver.mock";
import { createMockedEventConfigurationResolver } from "./mock/event-configuration-resolver.mock";
import { createMockedInboxOutboxEventProcessor } from "./mock/inbox-outbox-event-processor.mock";
import { createMockedInboxOutboxOptionsFactory } from "./mock/inbox-outbox-options.mock";

describe('InboxOutboxEventProcessor', () => {

    let mockedDriver: DatabaseDriver;
    let mockedDriverFactory: DatabaseDriverFactory;
    let inboxOutboxOptions: InboxOutboxModuleOptions;
    let mockedInboxOutboxEventProcessor: InboxOutboxEventProcessorContract;
    let mockedEventConfigurationResolver: EventConfigurationResolverContract;
    let mockLogger: any; 
    
    beforeEach(() => {
      mockedDriver = createMockedDriver();
      mockedDriverFactory = createMockedDriverFactory(mockedDriver);
      inboxOutboxOptions = createMockedInboxOutboxOptionsFactory(mockedDriverFactory, []);
      mockedInboxOutboxEventProcessor = createMockedInboxOutboxEventProcessor();
      mockedEventConfigurationResolver = createMockedEventConfigurationResolver();
      mockLogger = {
        error: jest.fn(),
        log: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
      }; 
    });

    it('Should process the event and deliver it to the all listeners, resulting in calling remove on driver', async () => {

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

        const firstListener : IListener<any> = {
            handle: jest.fn().mockReturnValue({}),
            getName: jest.fn().mockReturnValue('listener'),
        };

        const secondListener : IListener<any> = {
            handle: jest.fn().mockReturnValue({}),
            getName: jest.fn().mockReturnValue('listener'),
        };
        

        const inboxOutboxEventProcessor = new InboxOutboxEventProcessor(
            mockLogger,
            mockedDriverFactory,
            mockedEventConfigurationResolver
        );

        const inboxOutboxTransportEvent : InboxOutboxTransportEvent = {
            readyToRetryAfter: new Date().getTime(),
            delivedToListeners: [],
            eventName: 'newEvent',
            eventPayload: {},
            expireAt: new Date().getTime() + 1000,
            id: 1,
            insertedAt: new Date().getTime(),
        };

        await inboxOutboxEventProcessor.process(inboxOutboxOptions.events[0], inboxOutboxTransportEvent, [firstListener, secondListener]);

        
        expect(mockedDriver.remove).toHaveBeenCalledTimes(1);
        expect(mockedDriver.flush).toHaveBeenCalledTimes(1);

    });

    it('Should process the event and deliver it to the all listeners, one with error, resulting in calling in not calling remove on driver', async () => {

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

        const firstListener : IListener<any> = {
            handle: jest.fn().mockReturnValue({}),
            getName: jest.fn().mockReturnValue('listener'),
        };

        const secondListener : IListener<any> = {
            handle: jest.fn().mockRejectedValue({}),
            getName: jest.fn().mockReturnValue('listener'),
        };
        

        const inboxOutboxEventProcessor = new InboxOutboxEventProcessor(
            mockLogger,
            mockedDriverFactory,
            mockedEventConfigurationResolver
        );

        const inboxOutboxTransportEvent : InboxOutboxTransportEvent = {
            readyToRetryAfter: new Date().getTime(),
            delivedToListeners: [],
            eventName: 'newEvent',
            eventPayload: {},
            expireAt: new Date().getTime() + 1000,
            id: 1,
            insertedAt: new Date().getTime(),
        };

        await inboxOutboxEventProcessor.process(inboxOutboxOptions.events[0], inboxOutboxTransportEvent, [firstListener, secondListener]);

        expect(mockedDriver.remove).not.toHaveBeenCalled();
        expect(mockedDriver.persist).toHaveBeenCalledTimes(1);
        expect(mockedDriver.flush).toHaveBeenCalledTimes(1);

    });
});