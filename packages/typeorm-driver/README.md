# NestJS Inbox Outbox MikroORM Driver

This package provides a driver for the NestJS Inbox Outbox library that uses TypeORM to interact with the database.

## Installation

```bash
npm install @nestixis/nestjs-inbox-outbox-typeorm-driver
```

## Compatibile know TypeORM drivers
- postgres
- mysql

## Registration example

```typescript
import {
  InboxOutboxModule
} from '@nestixis/nestjs-inbox-outbox';
import {
  InboxOutboxTransportEventMigrations,
  TypeORMDatabaseDriverFactory,
  TypeOrmInboxOutboxTransportEvent,
} from '@nestixis/nestjs-inbox-outbox-typeorm-driver';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Cat } from './cat.model';
import { NewCatEvent } from './new-cat.event';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'user',
      password: 'user',
      database: 'inbox_outbox',
      entities: [TypeOrmInboxOutboxTransportEvent],
      migrations: [...InboxOutboxTransportEventMigrations],
      logging: true,
      migrationsRun: true,
    }),
    InboxOutboxModule.registerAsync({
      imports: [
        TypeOrmModule.forFeature([TypeOrmInboxOutboxTransportEvent, Cat]),
      ],
      useFactory: (dataSource: DataSource) => {
        const driverFactory = new TypeORMDatabaseDriverFactory(dataSource);
        return {
          driverFactory: driverFactory,
          events: [
            {
              name: NewCatEvent.name,
              listeners: {
                expiresAtTTL: 1000 * 60 * 60 * 24,
                maxExecutionTimeTTL: 1000 * 60 * 60 * 24,
                readyToRetryAfterTTL: 10000,
              },
            },
          ],
          retryEveryMilliseconds: 1000,
          maxInboxOutboxTransportEventPerRetry: 10,
        };
      },
      inject: [DataSource],
    }),
  ],
  providers: [],
})
export class AppModule {}

```