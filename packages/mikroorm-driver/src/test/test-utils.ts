import { MikroORM } from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, DynamicModule, Type } from '@nestjs/common';
import { InboxOutboxModule, InboxOutboxModuleEventOptions } from '@nestixis/nestjs-inbox-outbox';
import { MikroOrmInboxOutboxTransportEvent } from '../model/mikroorm-inbox-outbox-transport-event.model';
import { MikroORMDatabaseDriverFactory } from '../driver/mikroorm-database-driver.factory';
import { randomUUID } from 'crypto';
import { Client } from 'pg';

export interface TestAppConfig {
  events: InboxOutboxModuleEventOptions[];
  additionalModules?: DynamicModule[];
  additionalEntities?: Type[];
  retryEveryMilliseconds?: number;
  maxInboxOutboxTransportEventPerRetry?: number;
}

export interface TestContext {
  app: INestApplication;
  orm: MikroORM;
  module: TestingModule;
  dbName: string;
}

export const BASE_CONNECTION = {
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
};

export async function createTestDatabase(): Promise<string> {
  const dbName = `test_inbox_outbox_${randomUUID().replace(/-/g, '_')}`;

  const client = new Client({
    ...BASE_CONNECTION,
    database: 'postgres',
  });
  await client.connect();
  await client.query(`CREATE DATABASE ${dbName}`);
  await client.end();

  return dbName;
}

export async function dropTestDatabase(dbName: string): Promise<void> {
  const client = new Client({
    ...BASE_CONNECTION,
    database: 'postgres',
  });
  await client.connect();
  await client.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
  await client.end();
}

export async function createTestApp(config: TestAppConfig): Promise<TestContext> {
  const dbName = await createTestDatabase();

  const mikroOrmModule = MikroOrmModule.forRoot({
    driver: PostgreSqlDriver,
    ...BASE_CONNECTION,
    dbName,
    entities: [MikroOrmInboxOutboxTransportEvent, ...(config.additionalEntities || [])],
    allowGlobalContext: true,
  });

  const inboxOutboxModule = InboxOutboxModule.registerAsync({
    imports: [MikroOrmModule],
    useFactory: (orm: MikroORM) => {
      const driverFactory = new MikroORMDatabaseDriverFactory(orm);
      return {
        driverFactory,
        events: config.events,
        retryEveryMilliseconds: config.retryEveryMilliseconds ?? 10000,
        maxInboxOutboxTransportEventPerRetry: config.maxInboxOutboxTransportEventPerRetry ?? 100,
      };
    },
    inject: [MikroORM],
    isGlobal: true,
  });

  const testingModule = await Test.createTestingModule({
    imports: [
      mikroOrmModule,
      inboxOutboxModule,
      ...(config.additionalModules || []),
    ],
  }).compile();

  const app = testingModule.createNestApplication();
  await app.init();

  const orm = testingModule.get(MikroORM);

  await createSchema(orm);

  return {
    app,
    orm,
    module: testingModule,
    dbName,
  };
}

async function createSchema(orm: MikroORM): Promise<void> {
  const generator = orm.getSchemaGenerator();
  await generator.createSchema();
}

export async function cleanupTestApp(context: TestContext): Promise<void> {
  await context.app.close();
  await context.orm.close();
  await dropTestDatabase(context.dbName);
}
