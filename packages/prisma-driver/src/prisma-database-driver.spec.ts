import { PrismaClient } from '@generated-dev-prisma/client';
import { PrismaDatabaseDriver } from './prisma-database-driver';
import { EventConfigurationResolverContract, InboxOutboxModuleEventOptions } from '@nestixis/nestjs-inbox-outbox';

describe('PrismaDatabaseDriver (Full e2e)', () => {
  let prisma: PrismaClient;
  let driver: PrismaDatabaseDriver;

  const mockResolver: EventConfigurationResolverContract = {
    resolve: (eventName: string): InboxOutboxModuleEventOptions => ({
      name: eventName,
      listeners: {
        expiresAtTTL: 60_000,
        readyToRetryAfterTTL: 5_000,
        maxExecutionTimeTTL: 30_000,
      },
    }),
  };

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    driver = new PrismaDatabaseDriver(prisma, mockResolver);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // clear the table before each test
    await prisma.inboxOutboxTransportEvent.deleteMany({});
  });

  it('should process the full event lifecycle', async () => {
    const now = Date.now();

    // Create an event
    const event = driver.createInboxOutboxTransportEvent(
      'FullFlowEvent',
      { foo: 'bar' },
      now + 10_000,
      null,
    );

    expect(event.id).toBe(0);
    expect(event.delivedToListeners).toEqual([]);

    // Persist + flush → write to database
    await driver.persist(event);
    await driver.flush();

    let dbEvent = await prisma.inboxOutboxTransportEvent.findFirst({
      where: { eventName: 'FullFlowEvent' },
    });

    expect(dbEvent).toBeDefined();
    expect(dbEvent!.readyToRetryAfter).toBeNull();

    // Simulating time: the event is ready to be retried
    const pastTime = now - 5000;
    await prisma.inboxOutboxTransportEvent.update({
      where: { id: dbEvent!.id },
      data: { readyToRetryAfter: pastTime },
    });

    // findAndExtendReadyToRetryEvents → update readyToRetryAfter
    const readyEvents = await driver.findAndExtendReadyToRetryEvents(10);

    expect(readyEvents.length).toBe(1);
    expect(readyEvents[0].id).toBe(dbEvent!.id);
    expect(readyEvents[0].readyToRetryAfter).toBeGreaterThan(Date.now());

    // We check that the database has also been updated
    dbEvent = await prisma.inboxOutboxTransportEvent.findUnique({
      where: { id: dbEvent!.id },
    });
    expect(dbEvent!.readyToRetryAfter).toBeGreaterThan(Date.now());

    // Remove the event
    await driver.remove(readyEvents[0]);
    await driver.flush();

    dbEvent = await prisma.inboxOutboxTransportEvent.findUnique({
      where: { id: readyEvents[0].id },
    });
    expect(dbEvent).toBeNull();
  });
});
