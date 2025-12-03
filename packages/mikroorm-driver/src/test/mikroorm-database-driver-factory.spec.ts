import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MikroORM } from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { EventConfigurationResolverContract } from '@nestixis/nestjs-inbox-outbox';
import { MikroOrmInboxOutboxTransportEvent } from '../model/mikroorm-inbox-outbox-transport-event.model';
import { MikroORMDatabaseDriverFactory } from '../driver/mikroorm-database-driver.factory';
import { MikroORMDatabaseDriver } from '../driver/mikroorm.database-driver';
import { createTestDatabase, dropTestDatabase } from './test-utils';

describe('MikroORMDatabaseDriverFactory', () => {
  let orm: MikroORM;
  let dbName: string;

  const createEventConfigResolver = (): EventConfigurationResolverContract => ({
    resolve: () => ({
      name: 'TestEvent',
      listeners: {
        expiresAtTTL: 60000,
        readyToRetryAfterTTL: 5000,
        maxExecutionTimeTTL: 30000,
      },
    }),
  });

  beforeAll(async () => {
    dbName = await createTestDatabase();
    orm = await MikroORM.init({
      driver: PostgreSqlDriver,
      host: 'localhost',
      port: 5432,
      user: 'postgres',
      password: 'postgres',
      dbName,
      entities: [MikroOrmInboxOutboxTransportEvent],
      allowGlobalContext: true,
    });
    await orm.getSchemaGenerator().createSchema();
  });

  afterAll(async () => {
    await orm.close();
    await dropTestDatabase(dbName);
  });

  describe('create', () => {
    it('should create a MikroORMDatabaseDriver instance', () => {
      const factory = new MikroORMDatabaseDriverFactory(orm);
      const driver = factory.create(createEventConfigResolver());

      expect(driver).toBeInstanceOf(MikroORMDatabaseDriver);
    });

    it('should create drivers with forked entity managers', async () => {
      const factory = new MikroORMDatabaseDriverFactory(orm);

      const driver1 = factory.create(createEventConfigResolver());
      const driver2 = factory.create(createEventConfigResolver());

      const event1 = driver1.createInboxOutboxTransportEvent('Event1', {}, Date.now() + 60000, Date.now() + 5000);
      const event2 = driver2.createInboxOutboxTransportEvent('Event2', {}, Date.now() + 60000, Date.now() + 5000);

      await driver1.persist(event1);
      await driver2.persist(event2);

      await driver1.flush();
      await driver2.flush();

      const checkEm = orm.em.fork();
      const events = await checkEm.find(MikroOrmInboxOutboxTransportEvent, {});
      expect(events).toHaveLength(2);
    });

    it('should create isolated drivers that do not share state', async () => {
      const factory = new MikroORMDatabaseDriverFactory(orm);

      const driver1 = factory.create(createEventConfigResolver());
      const driver2 = factory.create(createEventConfigResolver());

      const event = driver1.createInboxOutboxTransportEvent('IsolationTest', {}, Date.now() + 60000, Date.now() + 5000);
      await driver1.persist(event);

      await driver2.flush();

      const checkEm = orm.em.fork();
      const events = await checkEm.find(MikroOrmInboxOutboxTransportEvent, { eventName: 'IsolationTest' });
      expect(events).toHaveLength(0);

      await driver1.flush();

      const checkEm2 = orm.em.fork();
      const eventsAfter = await checkEm2.find(MikroOrmInboxOutboxTransportEvent, { eventName: 'IsolationTest' });
      expect(eventsAfter).toHaveLength(1);
    });

    it('should allow concurrent operations without interference', async () => {
      const factory = new MikroORMDatabaseDriverFactory(orm);

      const operations = Array.from({ length: 5 }, async (_, i) => {
        const driver = factory.create(createEventConfigResolver());
        const event = driver.createInboxOutboxTransportEvent(`ConcurrentEvent${i}`, { index: i }, Date.now() + 60000, Date.now() + 5000);
        await driver.persist(event);
        await driver.flush();
        return event;
      });

      await Promise.all(operations);

      const checkEm = orm.em.fork();
      const events = await checkEm.find(MikroOrmInboxOutboxTransportEvent, {
        eventName: { $like: 'ConcurrentEvent%' },
      });

      expect(events).toHaveLength(5);
      const indices = events.map(e => e.eventPayload.index).sort();
      expect(indices).toEqual([0, 1, 2, 3, 4]);
    });
  });
});
