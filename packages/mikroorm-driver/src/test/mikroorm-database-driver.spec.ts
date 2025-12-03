import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MikroORM, Entity, PrimaryKey, Property } from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { EventConfigurationResolverContract } from '@nestixis/nestjs-inbox-outbox';
import { MikroOrmInboxOutboxTransportEvent } from '../model/mikroorm-inbox-outbox-transport-event.model';
import { MikroORMDatabaseDriver } from '../driver/mikroorm.database-driver';
import { createTestDatabase, dropTestDatabase } from './test-utils';

@Entity({ tableName: 'test_entity' })
class TestEntity {
  @PrimaryKey()
  id: number;

  @Property()
  name: string;
}

describe('MikroORMDatabaseDriver', () => {
  let orm: MikroORM;
  let dbName: string;

  const createEventConfigResolver = (readyToRetryAfterTTL = 5000): EventConfigurationResolverContract => ({
    resolve: () => ({
      name: 'TestEvent',
      listeners: {
        expiresAtTTL: 60000,
        readyToRetryAfterTTL,
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
      entities: [MikroOrmInboxOutboxTransportEvent, TestEntity],
      allowGlobalContext: true,
    });
    await orm.getSchemaGenerator().createSchema();
  });

  afterAll(async () => {
    await orm.close();
    await dropTestDatabase(dbName);
  });

  beforeEach(async () => {
    await orm.em.nativeDelete(MikroOrmInboxOutboxTransportEvent, {});
    await orm.em.nativeDelete(TestEntity, {});
    orm.em.clear();
  });

  describe('createInboxOutboxTransportEvent', () => {
    it('should create a transport event', () => {
      const em = orm.em.fork();
      const driver = new MikroORMDatabaseDriver(em, createEventConfigResolver());

      const event = driver.createInboxOutboxTransportEvent(
        'TestEvent',
        { data: 'test' },
        Date.now() + 60000,
        Date.now() + 5000,
      );

      expect(event).toBeInstanceOf(MikroOrmInboxOutboxTransportEvent);
      expect(event.eventName).toBe('TestEvent');
      expect(event.eventPayload).toEqual({ data: 'test' });
    });
  });

  describe('persist', () => {
    it('should queue entity for persistence', async () => {
      const em = orm.em.fork();
      const driver = new MikroORMDatabaseDriver(em, createEventConfigResolver());

      const event = driver.createInboxOutboxTransportEvent(
        'TestEvent',
        { data: 'test' },
        Date.now() + 60000,
        Date.now() + 5000,
      );

      await driver.persist(event);
      await driver.flush();

      const freshEm = orm.em.fork();
      const retrieved = await freshEm.findOne(MikroOrmInboxOutboxTransportEvent, { eventName: 'TestEvent' });
      expect(retrieved).toBeDefined();
    });

    it('should persist multiple entities', async () => {
      const em = orm.em.fork();
      const driver = new MikroORMDatabaseDriver(em, createEventConfigResolver());

      const entity = new TestEntity();
      entity.name = 'Test';

      const event = driver.createInboxOutboxTransportEvent(
        'TestEvent',
        {},
        Date.now() + 60000,
        Date.now() + 5000,
      );

      await driver.persist(entity);
      await driver.persist(event);
      await driver.flush();

      const freshEm = orm.em.fork();
      const retrievedEntity = await freshEm.findOne(TestEntity, { name: 'Test' });
      const retrievedEvent = await freshEm.findOne(MikroOrmInboxOutboxTransportEvent, { eventName: 'TestEvent' });

      expect(retrievedEntity).toBeDefined();
      expect(retrievedEvent).toBeDefined();
    });
  });

  describe('remove', () => {
    it('should queue entity for removal', async () => {
      const em = orm.em.fork();
      const driver = new MikroORMDatabaseDriver(em, createEventConfigResolver());

      const event = driver.createInboxOutboxTransportEvent(
        'RemoveTest',
        {},
        Date.now() + 60000,
        Date.now() + 5000,
      );

      await driver.persist(event);
      await driver.flush();

      const freshEm = orm.em.fork();
      const eventToRemove = await freshEm.findOne(MikroOrmInboxOutboxTransportEvent, { eventName: 'RemoveTest' });
      expect(eventToRemove).toBeDefined();

      const removeDriver = new MikroORMDatabaseDriver(freshEm, createEventConfigResolver());
      await removeDriver.remove(eventToRemove!);
      await removeDriver.flush();

      const checkEm = orm.em.fork();
      const removed = await checkEm.findOne(MikroOrmInboxOutboxTransportEvent, { eventName: 'RemoveTest' });
      expect(removed).toBeNull();
    });
  });

  describe('flush', () => {
    it('should persist all queued entities atomically', async () => {
      const em = orm.em.fork();
      const driver = new MikroORMDatabaseDriver(em, createEventConfigResolver());

      const event1 = driver.createInboxOutboxTransportEvent('Event1', {}, Date.now() + 60000, Date.now() + 5000);
      const event2 = driver.createInboxOutboxTransportEvent('Event2', {}, Date.now() + 60000, Date.now() + 5000);

      await driver.persist(event1);
      await driver.persist(event2);

      const checkBeforeFlush = orm.em.fork();
      const beforeFlush = await checkBeforeFlush.find(MikroOrmInboxOutboxTransportEvent, {});
      expect(beforeFlush).toHaveLength(0);

      await driver.flush();

      const checkAfterFlush = orm.em.fork();
      const afterFlush = await checkAfterFlush.find(MikroOrmInboxOutboxTransportEvent, {});
      expect(afterFlush).toHaveLength(2);
    });

    it('should clear entity manager after flush', async () => {
      const em = orm.em.fork();
      const driver = new MikroORMDatabaseDriver(em, createEventConfigResolver());

      const event = driver.createInboxOutboxTransportEvent('ClearTest', {}, Date.now() + 60000, Date.now() + 5000);
      await driver.persist(event);
      await driver.flush();

      const managedEntities = em.getUnitOfWork().getIdentityMap().values();
      expect([...managedEntities]).toHaveLength(0);
    });
  });

  describe('findAndExtendReadyToRetryEvents', () => {
    it('should find events ready to retry', async () => {
      const setupEm = orm.em.fork();
      const now = Date.now();

      const readyEvent = new MikroOrmInboxOutboxTransportEvent().create('ReadyEvent', {}, now + 60000, now - 1000);
      const notReadyEvent = new MikroOrmInboxOutboxTransportEvent().create('NotReadyEvent', {}, now + 60000, now + 60000);

      setupEm.persist([readyEvent, notReadyEvent]);
      await setupEm.flush();

      const em = orm.em.fork();
      const driver = new MikroORMDatabaseDriver(em, createEventConfigResolver(10000));

      const events = await driver.findAndExtendReadyToRetryEvents(10);

      expect(events).toHaveLength(1);
      expect(events[0].eventName).toBe('ReadyEvent');
    });

    it('should extend readyToRetryAfter timestamp', async () => {
      const setupEm = orm.em.fork();
      const now = Date.now();
      const originalRetryAfter = now - 1000;

      const event = new MikroOrmInboxOutboxTransportEvent().create('ExtendTest', {}, now + 60000, originalRetryAfter);
      setupEm.persist(event);
      await setupEm.flush();

      const em = orm.em.fork();
      const ttl = 10000;
      const driver = new MikroORMDatabaseDriver(em, createEventConfigResolver(ttl));

      const events = await driver.findAndExtendReadyToRetryEvents(10);

      expect(events).toHaveLength(1);
      expect(events[0].readyToRetryAfter).toBeGreaterThan(now);

      const checkEm = orm.em.fork();
      const persisted = await checkEm.findOne(MikroOrmInboxOutboxTransportEvent, { eventName: 'ExtendTest' });
      expect(persisted!.readyToRetryAfter).toBeGreaterThan(now);
    });

    it('should respect limit parameter', async () => {
      const setupEm = orm.em.fork();
      const now = Date.now();

      const events = Array.from({ length: 5 }, (_, i) =>
        new MikroOrmInboxOutboxTransportEvent().create(`Event${i}`, {}, now + 60000, now - 1000)
      );
      setupEm.persist(events);
      await setupEm.flush();

      const em = orm.em.fork();
      const driver = new MikroORMDatabaseDriver(em, createEventConfigResolver());

      const result = await driver.findAndExtendReadyToRetryEvents(3);

      expect(result).toHaveLength(3);
    });

    it('should return empty array when no events are ready', async () => {
      const setupEm = orm.em.fork();
      const event = new MikroOrmInboxOutboxTransportEvent().create('FutureEvent', {}, Date.now() + 60000, Date.now() + 60000);
      setupEm.persist(event);
      await setupEm.flush();

      const em = orm.em.fork();
      const driver = new MikroORMDatabaseDriver(em, createEventConfigResolver());

      const result = await driver.findAndExtendReadyToRetryEvents(10);

      expect(result).toHaveLength(0);
    });

    it('should use pessimistic locking for concurrent access', async () => {
      const setupEm = orm.em.fork();
      const now = Date.now();

      const events = Array.from({ length: 10 }, (_, i) =>
        new MikroOrmInboxOutboxTransportEvent().create(`ConcurrentEvent${i}`, {}, now + 60000, now - 1000)
      );
      setupEm.persist(events);
      await setupEm.flush();

      const em1 = orm.em.fork();
      const em2 = orm.em.fork();
      const driver1 = new MikroORMDatabaseDriver(em1, createEventConfigResolver());
      const driver2 = new MikroORMDatabaseDriver(em2, createEventConfigResolver());

      const [result1, result2] = await Promise.all([
        driver1.findAndExtendReadyToRetryEvents(5),
        driver2.findAndExtendReadyToRetryEvents(5),
      ]);

      const allEventNames = [...result1.map(e => e.eventName), ...result2.map(e => e.eventName)];
      const uniqueEventNames = new Set(allEventNames);
      expect(uniqueEventNames.size).toBe(allEventNames.length);
    });
  });
});
