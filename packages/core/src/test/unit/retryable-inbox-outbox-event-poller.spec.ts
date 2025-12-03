import { Logger } from '@nestjs/common';
import { DatabaseDriverFactory } from '../../driver/database-driver.factory';
import { DatabaseDriver } from '../../driver/database.driver';
import { TransactionalEventEmitter } from '../../emitter/transactional-event-emitter';
import { InboxOutboxModuleOptions } from '../../inbox-outbox.module-definition';
import { RetryableInboxOutboxEventPoller } from '../../poller/retryable-inbox-outbox-event.poller';
import { InboxOutboxEventProcessorContract } from '../../processor/inbox-outbox-event-processor.contract';
import { EventConfigurationResolver } from '../../resolver/event-configuration.resolver';
import { createMockedDriverFactory } from './mock/driver-factory.mock';
import { createMockedDriver } from './mock/driver.mock';
import { createMockedInboxOutboxOptionsFactory } from './mock/inbox-outbox-options.mock';

describe('RetryableInboxOutboxEventPoller', () => {
  let mockedDriver: DatabaseDriver;
  let mockedDriverFactory: DatabaseDriverFactory;
  let inboxOutboxOptions: InboxOutboxModuleOptions;
  let mockLogger: Logger;
  let mockTransactionalEventEmitter: TransactionalEventEmitter;
  let mockEventConfigurationResolver: EventConfigurationResolver;
  let mockInboxOutboxEventProcessor: InboxOutboxEventProcessorContract;

  beforeEach(() => {
    jest.useFakeTimers();
    mockedDriver = createMockedDriver();
    mockedDriverFactory = createMockedDriverFactory(mockedDriver);
    inboxOutboxOptions = createMockedInboxOutboxOptionsFactory(mockedDriverFactory, [
      {
        name: 'testEvent',
        listeners: {
          expiresAtTTL: 1000,
          readyToRetryAfterTTL: 1000,
          maxExecutionTimeTTL: 1000,
        },
      },
    ]);
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as unknown as Logger;

    mockTransactionalEventEmitter = {
      getListeners: jest.fn().mockReturnValue([]),
    } as unknown as TransactionalEventEmitter;

    mockEventConfigurationResolver = {} as EventConfigurationResolver;

    mockInboxOutboxEventProcessor = {
      process: jest.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function createPoller() {
    return new RetryableInboxOutboxEventPoller(
      inboxOutboxOptions,
      mockedDriverFactory,
      mockInboxOutboxEventProcessor,
      mockTransactionalEventEmitter,
      mockEventConfigurationResolver,
      mockLogger,
    );
  }

  describe('onModuleDestroy', () => {
    it('should unsubscribe from interval on shutdown', async () => {
      const poller = createPoller();
      await poller.onModuleInit();

      await poller.onModuleDestroy();

      expect(mockLogger.log).toHaveBeenCalledWith('Shutting down RetryableInboxOutboxEventPoller...');
      expect(mockLogger.log).toHaveBeenCalledWith('RetryableInboxOutboxEventPoller shutdown complete.');
    });

    it('should stop polling after shutdown is initiated', async () => {
      (mockedDriver.findAndExtendReadyToRetryEvents as jest.Mock).mockResolvedValue([]);
      const poller = createPoller();
      await poller.onModuleInit();

      jest.advanceTimersByTime(inboxOutboxOptions.retryEveryMilliseconds);
      await Promise.resolve();

      const callCountBeforeShutdown = (mockedDriver.findAndExtendReadyToRetryEvents as jest.Mock).mock.calls.length;

      await poller.onModuleDestroy();

      jest.advanceTimersByTime(inboxOutboxOptions.retryEveryMilliseconds * 5);
      await Promise.resolve();

      const callCountAfterShutdown = (mockedDriver.findAndExtendReadyToRetryEvents as jest.Mock).mock.calls.length;
      expect(callCountAfterShutdown).toBe(callCountBeforeShutdown);
    });

    it('should wait for in-flight processing to complete before shutdown', async () => {
      let resolveProcessing: () => void;
      const processingPromise = new Promise<void>((resolve) => {
        resolveProcessing = resolve;
      });

      (mockInboxOutboxEventProcessor.process as jest.Mock).mockReturnValue(processingPromise);

      const mockEvent = {
        id: 1,
        eventName: 'testEvent',
        eventPayload: {},
        deliveredToListeners: [],
        readyToRetryAfter: Date.now(),
        expireAt: Date.now() + 1000,
        insertedAt: Date.now(),
      };
      (mockedDriver.findAndExtendReadyToRetryEvents as jest.Mock).mockResolvedValue([mockEvent]);

      const poller = createPoller();
      await poller.onModuleInit();

      jest.advanceTimersByTime(inboxOutboxOptions.retryEveryMilliseconds);
      await Promise.resolve();
      await Promise.resolve();

      const shutdownPromise = poller.onModuleDestroy();

      expect(mockLogger.log).toHaveBeenCalledWith('Shutting down RetryableInboxOutboxEventPoller...');
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('Waiting for'));

      let shutdownCompleted = false;
      shutdownPromise.then(() => {
        shutdownCompleted = true;
      });

      await Promise.resolve();
      expect(shutdownCompleted).toBe(false);

      resolveProcessing!();
      await shutdownPromise;

      expect(mockLogger.log).toHaveBeenCalledWith('All in-flight events completed.');
      expect(mockLogger.log).toHaveBeenCalledWith('RetryableInboxOutboxEventPoller shutdown complete.');
    });

    it('should handle shutdown when no in-flight processing exists', async () => {
      (mockedDriver.findAndExtendReadyToRetryEvents as jest.Mock).mockResolvedValue([]);
      const poller = createPoller();
      await poller.onModuleInit();

      await poller.onModuleDestroy();

      expect(mockLogger.log).toHaveBeenCalledWith('Shutting down RetryableInboxOutboxEventPoller...');
      expect(mockLogger.log).not.toHaveBeenCalledWith(expect.stringContaining('Waiting for'));
      expect(mockLogger.log).toHaveBeenCalledWith('RetryableInboxOutboxEventPoller shutdown complete.');
    });

    it('should handle shutdown gracefully even if called before onModuleInit', async () => {
      const poller = createPoller();

      await poller.onModuleDestroy();

      expect(mockLogger.log).toHaveBeenCalledWith('Shutting down RetryableInboxOutboxEventPoller...');
      expect(mockLogger.log).toHaveBeenCalledWith('RetryableInboxOutboxEventPoller shutdown complete.');
    });
  });
});
