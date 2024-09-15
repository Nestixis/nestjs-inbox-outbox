# NestJS Inbox Outbox MikroORM Driver

This package provides a driver for the NestJS Inbox Outbox library that uses MikroORM to interact with the database.

## Installation

```bash
npm install @nestixis/nestjs-inbox-outbox-mikroorm-driver
```

## Compatibile know MikroORM drivers
- PostgreSqlDriver
- MySqlDriver

## Registration example

```typescript
import { MigrationObject, MikroORM } from '@mikro-orm/core';
import { Migrator } from '@mikro-orm/migrations';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { InboxOutboxModule } from '@nestixis/nestjs-inbox-outbox';
import {
  InboxOutboxMigrations,
  MikroORMDatabaseDriverFactory,
  MikroOrmInboxOutboxTransportEvent,
} from '@nestixis/nestjs-inbox-outbox-mikroorm-driver';
import { Module } from '@nestjs/common';
import { NewCatEvent } from './new-cat.event';

export class TableMigrator implements OnApplicationBootstrap {
  constructor(private mikroORM: MikroORM) {}

  async onApplicationBootstrap(): Promise<any> {
    await this.mikroORM.getMigrator().up();
  }
}

const mapMigration = (migration): MigrationObject => {
  return {
    name: migration.name,
    class: migration,
  };
};

const migrationList = InboxOutboxMigrations.map(mapMigration);

@Module({
  imports: [
    MikroOrmModule.forRootAsync({
      useFactory: () => {
        return {
          host: 'localhost',
          dbName: 'inbox_outbox',
          user: 'user',
          password: 'user',
          port: 5432,
          pool: {
            min: 0,
            max: 5,
          },
          migrations: {
            dropTables: true,
            allOrNothing: true,
            migrationsList: migrationList,
          },
          entities: [MikroOrmInboxOutboxTransportEvent],
          driver: PostgreSqlDriver, 
          registerRequestContext: true,
          extensions: [Migrator],
        };
      },
      inject: [],
    }),
     InboxOutboxModule.registerAsync({
      imports: [
        MikroOrmModule.forFeature([MikroOrmInboxOutboxTransportEvent]),
      ],
      useFactory: (orm: MikroORM) => {
        const driverFactory = new MikroORMDatabaseDriverFactory(orm);
        return {
          driverFactory: driverFactory,
          events: [
            {
              name: NewCatEvent.name,
              listeners: {
                expiresAtTTL: 1000 * 60 * 60 * 24,
                maxExecutionTimeTTL: 1000 * 60 * 60 * 24,
                readyToRetryAfterTTL: 5000,
              },
            },
          ],
          retryEveryMilliseconds: 1000,
          maxInboxOutboxTransportEventPerRetry: 10,
        };
      },
      inject: [MikroORM],
    }),
  ],
  providers: [TableMigrator],
})
export class AppModule {}

```