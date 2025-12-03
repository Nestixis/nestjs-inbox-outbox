import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MikroORM } from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { MikroOrmInboxOutboxTransportEvent } from '../model/mikroorm-inbox-outbox-transport-event.model';
import { createTestDatabase, dropTestDatabase } from './test-utils';

describe('MikroOrmInboxOutboxTransportEvent', () => {
  let orm: MikroORM;
  let dbName: string;

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

  beforeEach(async () => {
    await orm.em.nativeDelete(MikroOrmInboxOutboxTransportEvent, {});
    orm.em.clear();
  });

  describe('create factory method', () => {
    it('should create an event with all required properties', () => {
      const eventName = 'TestEvent';
      const eventPayload = { userId: 123, action: 'test' };
      const expireAt = Date.now() + 60000;
      const readyToRetryAfter = Date.now() + 5000;

      const event = new MikroOrmInboxOutboxTransportEvent().create(
        eventName,
        eventPayload,
        expireAt,
        readyToRetryAfter,
      );

      expect(event.eventName).toBe(eventName);
      expect(event.eventPayload).toEqual(eventPayload);
      expect(event.expireAt).toBe(expireAt);
      expect(event.readyToRetryAfter).toBe(readyToRetryAfter);
      expect(event.delivedToListeners).toEqual([]);
      expect(event.insertedAt).toBeDefined();
      expect(event.insertedAt).toBeLessThanOrEqual(Date.now());
    });

    it('should handle null readyToRetryAfter', () => {
      const event = new MikroOrmInboxOutboxTransportEvent().create(
        'TestEvent',
        {},
        Date.now() + 60000,
        null,
      );

      expect(event.readyToRetryAfter).toBeNull();
    });
  });

  describe('persistence', () => {
    it('should persist and retrieve an event', async () => {
      const eventPayload = { key: 'value', nested: { data: 123 } };
      const event = new MikroOrmInboxOutboxTransportEvent().create(
        'PersistenceTest',
        eventPayload,
        Date.now() + 60000,
        Date.now() + 5000,
      );

      orm.em.persist(event);
      await orm.em.flush();
      orm.em.clear();

      const retrieved = await orm.em.findOne(MikroOrmInboxOutboxTransportEvent, { eventName: 'PersistenceTest' });

      expect(retrieved).toBeDefined();
      expect(retrieved!.eventName).toBe('PersistenceTest');
      expect(retrieved!.eventPayload).toEqual(eventPayload);
      expect(retrieved!.delivedToListeners).toEqual([]);
    });

    it('should persist JSON payload correctly', async () => {
      const complexPayload = {
        string: 'test',
        number: 42,
        boolean: true,
        array: [1, 2, 3],
        nested: { deep: { value: 'nested' } },
      };

      const event = new MikroOrmInboxOutboxTransportEvent().create(
        'JsonTest',
        complexPayload,
        Date.now() + 60000,
        Date.now() + 5000,
      );

      orm.em.persist(event);
      await orm.em.flush();
      orm.em.clear();

      const retrieved = await orm.em.findOne(MikroOrmInboxOutboxTransportEvent, { eventName: 'JsonTest' });

      expect(retrieved!.eventPayload).toEqual(complexPayload);
    });

    it('should persist delivedToListeners as JSON array', async () => {
      const event = new MikroOrmInboxOutboxTransportEvent().create(
        'ListenersTest',
        {},
        Date.now() + 60000,
        Date.now() + 5000,
      );
      event.delivedToListeners = ['listener1', 'listener2'];

      orm.em.persist(event);
      await orm.em.flush();
      orm.em.clear();

      const retrieved = await orm.em.findOne(MikroOrmInboxOutboxTransportEvent, { eventName: 'ListenersTest' });

      expect(retrieved!.delivedToListeners).toEqual(['listener1', 'listener2']);
    });

    it('should generate auto-increment id on persist', async () => {
      const event1 = new MikroOrmInboxOutboxTransportEvent().create('Event1', {}, Date.now() + 60000, Date.now() + 5000);
      const event2 = new MikroOrmInboxOutboxTransportEvent().create('Event2', {}, Date.now() + 60000, Date.now() + 5000);

      orm.em.persist([event1, event2]);
      await orm.em.flush();

      expect(event1.id).toBeDefined();
      expect(event2.id).toBeDefined();
      expect(event2.id).toBeGreaterThan(event1.id);
    });
  });

  describe('querying', () => {
    it('should find events by readyToRetryAfter', async () => {
      const now = Date.now();
      const pastEvent = new MikroOrmInboxOutboxTransportEvent().create('PastEvent', {}, now + 60000, now - 1000);
      const futureEvent = new MikroOrmInboxOutboxTransportEvent().create('FutureEvent', {}, now + 60000, now + 60000);

      orm.em.persist([pastEvent, futureEvent]);
      await orm.em.flush();
      orm.em.clear();

      const readyEvents = await orm.em.find(MikroOrmInboxOutboxTransportEvent, {
        readyToRetryAfter: { $lte: now },
      });

      expect(readyEvents).toHaveLength(1);
      expect(readyEvents[0].eventName).toBe('PastEvent');
    });

    it('should respect limit when querying', async () => {
      const events = Array.from({ length: 5 }, (_, i) =>
        new MikroOrmInboxOutboxTransportEvent().create(`Event${i}`, {}, Date.now() + 60000, Date.now() - 1000)
      );

      orm.em.persist(events);
      await orm.em.flush();
      orm.em.clear();

      const limitedEvents = await orm.em.find(
        MikroOrmInboxOutboxTransportEvent,
        { readyToRetryAfter: { $lte: Date.now() } },
        { limit: 3 },
      );

      expect(limitedEvents).toHaveLength(3);
    });
  });

  describe('update', () => {
    it('should update readyToRetryAfter', async () => {
      const event = new MikroOrmInboxOutboxTransportEvent().create('UpdateTest', {}, Date.now() + 60000, Date.now() - 1000);

      orm.em.persist(event);
      await orm.em.flush();

      const newRetryAfter = Date.now() + 30000;
      event.readyToRetryAfter = newRetryAfter;
      await orm.em.flush();
      orm.em.clear();

      const retrieved = await orm.em.findOne(MikroOrmInboxOutboxTransportEvent, { eventName: 'UpdateTest' });

      expect(retrieved!.readyToRetryAfter).toBe(newRetryAfter);
    });
  });

  describe('delete', () => {
    it('should delete an event', async () => {
      const event = new MikroOrmInboxOutboxTransportEvent().create('DeleteTest', {}, Date.now() + 60000, Date.now() + 5000);

      orm.em.persist(event);
      await orm.em.flush();

      orm.em.remove(event);
      await orm.em.flush();
      orm.em.clear();

      const retrieved = await orm.em.findOne(MikroOrmInboxOutboxTransportEvent, { eventName: 'DeleteTest' });

      expect(retrieved).toBeNull();
    });
  });
});
