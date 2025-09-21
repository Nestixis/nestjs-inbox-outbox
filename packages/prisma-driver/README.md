# @nestixis/nestjs-inbox-outbox Prisma Database Driver

A **Prisma** database driver for `@nestixis/nestjs-inbox-outbox` that allows
using a single database for Inbox/Outbox events without creating extra connections.
Fully compatible with NestJS and supports TTL, retry logic, and event lifecycle management.

---

## Installation

```bash
npm install @prisma/client
npm install @nestixis/nestjs-inbox-outbox
```

> Make sure to run `npx prisma db push` after setting up your schema to create the `inbox_outbox_transport_event` table.

---

## Prisma Schema

Prisma Schema:

```prisma
model InboxOutboxTransportEvent {
  id                 Int      @id @default(autoincrement())
  eventName          String
  eventPayload       Json
  delivedToListeners Json     @default("[]")
  readyToRetryAfter  BigInt?
  expireAt           BigInt
  insertedAt         BigInt

  @@map("inbox_outbox_transport_event")
}
```

> **Notes:**
>
> - `expireAt`, `insertedAt`, `readyToRetryAfter` → BigInt for millisecond timestamps.
> - `delivedToListeners` and `eventPayload` → JSON for complex objects.

---

## Usage

### Integration in NestJS

```typescript
import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { InboxOutboxModule } from '@nestixis/nestjs-inbox-outbox';
import { PrismaDatabaseDriverFactory } from './prisma/prisma-database-driver.factory';

@Module({
  imports: [
    InboxOutboxModule.registerAsync({
      isGlobal: true,
      imports: [],
      inject: [PrismaClient],
      useFactory: (prisma: PrismaClient) => {
        const driverFactory = new PrismaDatabaseDriverFactory(prisma);
        return {
          driverFactory,
          events: [
            {
              name: 'UserApplicationAssignedEvent',
              listeners: {
                expiresAtTTL: 1000 * 60 * 60 * 24,
                maxExecutionTimeTTL: 1000 * 15,
                readyToRetryAfterTTL: 10000,
              },
            },
          ],
          retryEveryMilliseconds: 30_000,
          maxInboxOutboxTransportEventPerRetry: 10,
        };
      },
    }),
  ],
})
export class AppModule {}
```

> `driverFactory` allows internal calls to `createInboxOutboxTransportEvent` without manually invoking it.

---

## Driver Features

- **Single PrismaClient** – no extra DB connections.
- **Full event lifecycle** – creation, persistence, removal, flush, retry logic.
- **TTL support** – `readyToRetryAfter`, `expiresAtTTL`, `maxExecutionTimeTTL`.
- **JSON payloads** – stores complex event payloads and listener tracking.
- **Easy NestJS integration** – via `PrismaDatabaseDriverFactory`.

---

## Event Lifecycle Example

1. **Create an event** via `driver.createInboxOutboxTransportEvent`.
2. **Persist + flush** → saved in DB.
3. **Fetch ready-to-retry events** → updates `readyToRetryAfter`.
4. **Remove events after processing**.

All handled internally by `PrismaDatabaseDriver`.

---

## Testing

Run integration tests:

```bash
npm run test
```

- Uses SQLite in-memory for testing.
- Validates creation, persistence, retry logic, and deletion.
- Ensures correct `readyToRetryAfter` handling.

---

## Advantages

- Minimal setup for NestJS projects.
- No extra DB connections required.
- Full lifecycle management with built-in retry logic.
- Easy to extend or adapt to custom event configs.
