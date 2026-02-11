import {
  DatabaseDriver,
  EventConfigurationResolverContract,
  InboxOutboxTransportEvent,
} from '@nestixis/nestjs-inbox-outbox';
import { PrismaClient } from '@generated-dev-prisma/client';

export class PrismaDatabaseDriver implements DatabaseDriver {
  private entitiesToPersist: InboxOutboxTransportEvent[] = [];
  private entitiesToRemove: InboxOutboxTransportEvent[] = [];

  constructor(
    private readonly prisma: PrismaClient,
    private readonly eventConfigurationResolver: EventConfigurationResolverContract,
  ) {}

  /**
   * We look for events that are ready to return and move them ReadyToRetryAfter forward
   */
  async findAndExtendReadyToRetryEvents(
    limit: number,
  ): Promise<InboxOutboxTransportEvent[]> {
    const now = Date.now();

    return this.prisma.$transaction(async (tx) => {
      // Finding events that can be retried
      const events = await tx.inboxOutboxTransportEvent.findMany({
        where: {
          readyToRetryAfter: { lte: now },
        },
        take: limit,
        orderBy: { insertedAt: 'asc' },
      });

      // Updating readyToRetryAfter according to configuration
      const updatedEvents: InboxOutboxTransportEvent[] = [];
      for (const event of events) {
        const eventConfig = this.eventConfigurationResolver.resolve(
          event.eventName,
        );
        const nextRetry = now + eventConfig.listeners.readyToRetryAfterTTL;

        const updated = await tx.inboxOutboxTransportEvent.update({
          where: { id: event.id },
          data: { readyToRetryAfter: nextRetry },
        });

        updatedEvents.push(updated as unknown as InboxOutboxTransportEvent);
      }

      return updatedEvents;
    });
  }

  /**
   * Delayed saving of an entity
   */
  async persist<T extends object>(entity: T): Promise<void> {
    this.entitiesToPersist.push(entity as InboxOutboxTransportEvent);
  }

  /**
   * Delayed removal of an entity
   */
  async remove<T extends object>(entity: T): Promise<void> {
    this.entitiesToRemove.push(entity as InboxOutboxTransportEvent);
  }

  /**
   * Saving/deleting accumulated changes transactionally
   */
  async flush(): Promise<void> {
    if (!this.entitiesToPersist.length && !this.entitiesToRemove.length) return;

    await this.prisma.$transaction(async (tx) => {
      if (this.entitiesToPersist.length > 0) {
        await Promise.all(
          this.entitiesToPersist.map((event) =>
            tx.inboxOutboxTransportEvent.create({
              data: {
                eventName: event.eventName,
                eventPayload: event.eventPayload,
                delivedToListeners: event.delivedToListeners ?? [],
                readyToRetryAfter: event.readyToRetryAfter ?? null,
                expireAt: event.expireAt,
                insertedAt: event.insertedAt,
              },
            }),
          ),
        );
      }

      if (this.entitiesToRemove.length > 0) {
        await Promise.all(
          this.entitiesToRemove.map((event) =>
            tx.inboxOutboxTransportEvent.delete({
              where: { id: event.id },
            }),
          ),
        );
      }
    });

    this.entitiesToPersist = [];
    this.entitiesToRemove = [];
  }

  /**
   * Create a new event
   */
  createInboxOutboxTransportEvent(
    eventName: string,
    eventPayload: any,
    expireAt: number,
    readyToRetryAfter: number | null,
  ): InboxOutboxTransportEvent {
    return {
      id: 0, // placeholder, the real identifier will be returned by the database
      eventName,
      eventPayload,
      delivedToListeners: [],
      readyToRetryAfter: readyToRetryAfter ?? null,
      expireAt,
      insertedAt: Date.now(),
    };
  }
}
