import 'reflect-metadata';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Entity, PrimaryKey, Property, MikroORM } from '@mikro-orm/core';
import {
  TransactionalEventEmitter,
  TransactionalEventEmitterOperations,
  InboxOutboxEvent,
  IListener,
} from '@nestixis/nestjs-inbox-outbox';
import { MikroOrmInboxOutboxTransportEvent } from '../model/mikroorm-inbox-outbox-transport-event.model';
import { createTestApp, cleanupTestApp, TestContext } from './test-utils';

@Entity({ tableName: 'users' })
class User {
  @PrimaryKey()
  id: number;

  @Property()
  email: string;

  @Property()
  name: string;
}

class UserCreatedEvent extends InboxOutboxEvent {
  public readonly name = 'UserCreated';

  constructor(
    public readonly userId: number,
    public readonly email: string,
  ) {
    super();
  }
}

class UserDeletedEvent extends InboxOutboxEvent {
  public readonly name = 'UserDeleted';

  constructor(public readonly userId: number) {
    super();
  }
}

describe('Integration Tests', () => {
  let context: TestContext;

  const defaultEvents = [
    {
      name: 'UserCreated',
      listeners: {
        expiresAtTTL: 60000,
        readyToRetryAfterTTL: 5000,
        maxExecutionTimeTTL: 30000,
      },
    },
    {
      name: 'UserDeleted',
      listeners: {
        expiresAtTTL: 60000,
        readyToRetryAfterTTL: 5000,
        maxExecutionTimeTTL: 30000,
      },
    },
  ];

  afterEach(async () => {
    if (context) {
      await cleanupTestApp(context);
    }
  });

  describe('TransactionalEventEmitter with MikroORM driver', () => {
    beforeEach(async () => {
      context = await createTestApp({
        events: defaultEvents,
        additionalEntities: [User],
      });
    });

    it('should emit an event and persist the entity', async () => {
      const emitter = context.module.get(TransactionalEventEmitter);
      const orm = context.orm;

      const user = new User();
      user.email = 'test@example.com';
      user.name = 'Test User';

      const handledEvents: UserCreatedEvent[] = [];
      const listener: IListener<UserCreatedEvent> = {
        getName: () => 'TestEventPersistenceListener',
        handle: async (event: UserCreatedEvent) => {
          handledEvents.push(event);
        },
      };
      emitter.addListener('UserCreated', listener);

      const event = new UserCreatedEvent(1, 'test@example.com');

      await emitter.emitAsync(event, [{ operation: TransactionalEventEmitterOperations.persist, entity: user }]);

      const em = orm.em.fork();
      const users = await em.find(User, {});
      expect(users).toHaveLength(1);
      expect(users[0].email).toBe('test@example.com');

      expect(handledEvents).toHaveLength(1);
      expect(handledEvents[0]).toMatchObject({
        name: 'UserCreated',
        userId: 1,
        email: 'test@example.com',
      });
    });

    it('should persist entity and event atomically', async () => {
      const emitter = context.module.get(TransactionalEventEmitter);
      const orm = context.orm;

      const user = new User();
      user.email = 'atomic@example.com';
      user.name = 'Atomic User';

      let handlerCalled = false;
      const listener: IListener<UserCreatedEvent> = {
        getName: () => 'AtomicTestListener',
        handle: async () => {
          handlerCalled = true;
        },
      };
      emitter.addListener('UserCreated', listener);

      const event = new UserCreatedEvent(2, 'atomic@example.com');

      await emitter.emitAsync(event, [{ operation: TransactionalEventEmitterOperations.persist, entity: user }]);

      const em = orm.em.fork();
      const users = await em.find(User, { email: 'atomic@example.com' });

      expect(users).toHaveLength(1);
      expect(handlerCalled).toBe(true);
    });

    it('should handle multiple entities in a single emit', async () => {
      const emitter = context.module.get(TransactionalEventEmitter);
      const orm = context.orm;

      const user1 = new User();
      user1.email = 'user1@example.com';
      user1.name = 'User 1';

      const user2 = new User();
      user2.email = 'user2@example.com';
      user2.name = 'User 2';

      const event = new UserCreatedEvent(1, 'user1@example.com');

      await emitter.emit(event, [
        { operation: TransactionalEventEmitterOperations.persist, entity: user1 },
        { operation: TransactionalEventEmitterOperations.persist, entity: user2 },
      ]);

      await new Promise(resolve => setTimeout(resolve, 100));

      const em = orm.em.fork();
      const users = await em.find(User, {});
      expect(users).toHaveLength(2);
    });

    it('should remove entity and process event', async () => {
      const orm = context.orm;

      const setupEm = orm.em.fork();
      const user = new User();
      user.email = 'delete@example.com';
      user.name = 'To Delete';
      setupEm.persist(user);
      await setupEm.flush();

      const userId = user.id;

      const emitter = context.module.get(TransactionalEventEmitter);

      let handlerCalled = false;
      let deletedUserId: number | undefined;
      const listener: IListener<UserDeletedEvent> = {
        getName: () => 'DeleteTestListener',
        handle: async (event: UserDeletedEvent) => {
          handlerCalled = true;
          deletedUserId = event.userId;
        },
      };
      emitter.addListener('UserDeleted', listener);

      const checkEm = orm.em.fork();
      const userToDelete = await checkEm.findOne(User, { id: userId });

      const event = new UserDeletedEvent(userId);
      await emitter.emitAsync(event, [{ operation: TransactionalEventEmitterOperations.remove, entity: userToDelete! }]);

      const finalEm = orm.em.fork();
      const deletedUser = await finalEm.findOne(User, { id: userId });
      expect(deletedUser).toBeNull();
      expect(handlerCalled).toBe(true);
      expect(deletedUserId).toBe(userId);
    });
  });

  describe('Listener management', () => {
    beforeEach(async () => {
      context = await createTestApp({
        events: defaultEvents,
        additionalEntities: [User],
      });
    });

    it('should add and invoke listeners', async () => {
      const emitter = context.module.get(TransactionalEventEmitter);
      const orm = context.orm;

      const handledEvents: UserCreatedEvent[] = [];

      const listener: IListener<UserCreatedEvent> = {
        getName: () => 'TestListener',
        handle: async (event: UserCreatedEvent) => {
          handledEvents.push(event);
        },
      };

      emitter.addListener('UserCreated', listener);

      const user = new User();
      user.email = 'listener@example.com';
      user.name = 'Listener User';

      const event = new UserCreatedEvent(1, 'listener@example.com');

      await emitter.emitAsync(event, [{ operation: TransactionalEventEmitterOperations.persist, entity: user }]);

      expect(handledEvents).toHaveLength(1);
      expect(handledEvents[0].email).toBe('listener@example.com');

      const em = orm.em.fork();
      const transportEvents = await em.find(MikroOrmInboxOutboxTransportEvent, { eventName: 'UserCreated' });
      expect(transportEvents).toHaveLength(0);
    });

    it('should remove listeners', async () => {
      const emitter = context.module.get(TransactionalEventEmitter);

      const listener: IListener<UserCreatedEvent> = {
        getName: () => 'RemovableListener',
        handle: async () => {},
      };

      emitter.addListener('UserCreated', listener);
      expect(emitter.getListeners('UserCreated')).toHaveLength(1);

      emitter.removeListeners('UserCreated');
      expect(emitter.getListeners('UserCreated')).toHaveLength(0);
    });

    it('should not allow duplicate listener names', async () => {
      const emitter = context.module.get(TransactionalEventEmitter);

      const listener1: IListener<UserCreatedEvent> = {
        getName: () => 'DuplicateListener',
        handle: async () => {},
      };

      const listener2: IListener<UserCreatedEvent> = {
        getName: () => 'DuplicateListener',
        handle: async () => {},
      };

      emitter.addListener('UserCreated', listener1);

      expect(() => emitter.addListener('UserCreated', listener2)).toThrow();
    });

    it('should handle multiple listeners for same event', async () => {
      const emitter = context.module.get(TransactionalEventEmitter);

      const results: string[] = [];

      const listener1: IListener<UserCreatedEvent> = {
        getName: () => 'Listener1',
        handle: async () => {
          results.push('listener1');
        },
      };

      const listener2: IListener<UserCreatedEvent> = {
        getName: () => 'Listener2',
        handle: async () => {
          results.push('listener2');
        },
      };

      emitter.addListener('UserCreated', listener1);
      emitter.addListener('UserCreated', listener2);

      const user = new User();
      user.email = 'multi@example.com';
      user.name = 'Multi Listener User';

      const event = new UserCreatedEvent(1, 'multi@example.com');

      await emitter.emitAsync(event, [{ operation: TransactionalEventEmitterOperations.persist, entity: user }]);

      expect(results).toContain('listener1');
      expect(results).toContain('listener2');
    });
  });

  describe('Event configuration', () => {
    it('should throw error for unconfigured event', async () => {
      context = await createTestApp({
        events: [
          {
            name: 'ConfiguredEvent',
            listeners: {
              expiresAtTTL: 60000,
              readyToRetryAfterTTL: 5000,
              maxExecutionTimeTTL: 30000,
            },
          },
        ],
        additionalEntities: [User],
      });

      const emitter = context.module.get(TransactionalEventEmitter);

      const unconfiguredEvent = new UserCreatedEvent(1, 'test@example.com');

      await expect(emitter.emit(unconfiguredEvent, [])).rejects.toThrow(
        /Event UserCreated is not configured/,
      );
    });
  });

  describe('Event retry mechanism', () => {
    beforeEach(async () => {
      context = await createTestApp({
        events: [
          {
            name: 'UserCreated',
            listeners: {
              expiresAtTTL: 60000,
              readyToRetryAfterTTL: 100,
              maxExecutionTimeTTL: 30000,
            },
          },
        ],
        additionalEntities: [User],
        retryEveryMilliseconds: 5000,
        maxInboxOutboxTransportEventPerRetry: 10,
      });
    });

    it('should set readyToRetryAfter based on configuration', async () => {
      const emitter = context.module.get(TransactionalEventEmitter);
      const orm = context.orm;

      const user = new User();
      user.email = 'retry@example.com';
      user.name = 'Retry User';

      const failingListener: IListener<UserCreatedEvent> = {
        getName: () => 'FailingRetryListener',
        handle: async () => {
          throw new Error('Intentional failure to keep event in database');
        },
      };
      emitter.addListener('UserCreated', failingListener);

      const beforeEmit = Date.now();
      const event = new UserCreatedEvent(1, 'retry@example.com');

      await emitter.emitAsync(event, [{ operation: TransactionalEventEmitterOperations.persist, entity: user }]);

      const em = orm.em.fork();
      const transportEvents = await em.find(MikroOrmInboxOutboxTransportEvent, { eventName: 'UserCreated' });

      expect(transportEvents).toHaveLength(1);
      expect(transportEvents[0].readyToRetryAfter).toBeGreaterThanOrEqual(beforeEmit + 100);
    });

    it('should set expireAt based on configuration', async () => {
      const emitter = context.module.get(TransactionalEventEmitter);
      const orm = context.orm;

      const user = new User();
      user.email = 'expire@example.com';
      user.name = 'Expire User';

      const failingListener: IListener<UserCreatedEvent> = {
        getName: () => 'FailingExpireListener',
        handle: async () => {
          throw new Error('Intentional failure to keep event in database');
        },
      };
      emitter.addListener('UserCreated', failingListener);

      const beforeEmit = Date.now();
      const event = new UserCreatedEvent(1, 'expire@example.com');

      await emitter.emitAsync(event, [{ operation: TransactionalEventEmitterOperations.persist, entity: user }]);

      const em = orm.em.fork();
      const transportEvents = await em.find(MikroOrmInboxOutboxTransportEvent, { eventName: 'UserCreated' });

      expect(transportEvents).toHaveLength(1);
      expect(transportEvents[0].expireAt).toBeGreaterThanOrEqual(beforeEmit + 60000);
    });
  });
});
