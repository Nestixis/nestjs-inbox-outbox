import { EventValidator } from '../../event-validator/event.validator';
import { InboxOutboxModuleOptions } from '../../inbox-outbox.module-definition';

describe('EventValidator', () => {
  it('should throw an exception when event names are not unique', () => {
    const mockOptions: InboxOutboxModuleOptions = {
      driverFactory: null,
      maxInboxOutboxTransportEventPerRetry: 10,
      retryEveryMilliseconds: 1000,
      events: [
        {
          name: 'event1',
          listeners: {
            expiresAtTTL: 1000,
            readyToRetryAfterTTL: 1000,
            maxExecutionTimeTTL: 1000,
          },
        },
        {
          name: 'event1',
          listeners: {
            expiresAtTTL: 1000,
            readyToRetryAfterTTL: 1000,
            maxExecutionTimeTTL: 1000,
          },
        },
      ],
    };

    const eventValidator = new EventValidator(mockOptions);

    expect(() => eventValidator.onModuleInit()).toThrow(`Event names must be unique. Duplicate name: event1`);
  });

  it('should not throw an exception when event names are unique', () => {
    const mockOptions: InboxOutboxModuleOptions = {
      driverFactory: null,
      maxInboxOutboxTransportEventPerRetry: 10,
      retryEveryMilliseconds: 1000,
      events: [
        {
          name: 'event1',
          listeners: {
            expiresAtTTL: 1000,
            readyToRetryAfterTTL: 1000,
            maxExecutionTimeTTL: 1000,
          },
        },
        {
          name: 'event2',
          listeners: {
            expiresAtTTL: 1000,
            readyToRetryAfterTTL: 1000,
            maxExecutionTimeTTL: 1000,
          },
        },
      ],
    };

    const eventValidator = new EventValidator(mockOptions);

    expect(() => eventValidator.onModuleInit()).not.toThrow();
  });
});
