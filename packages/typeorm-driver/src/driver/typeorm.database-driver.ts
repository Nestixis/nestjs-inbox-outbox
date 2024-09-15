import { DatabaseDriver, EventConfigurationResolverContract, InboxOutboxTransportEvent } from '@nestixis/nestjs-inbox-outbox';
import { DataSource, LessThanOrEqual } from 'typeorm';
import { TypeOrmInboxOutboxTransportEvent } from '../model/typeorm-inbox-outbox-transport-event.model';
  
export class TypeORMDatabaseDriver implements DatabaseDriver {
 
  private entitiesToPersist: any[] = [];

  private enetitiesToRemove: any[] = [];
  
  constructor(private readonly dataSource: DataSource, private readonly eventConfigurationResolver: EventConfigurationResolverContract) {}

  async findAndExtendReadyToRetryEvents(limit: number): Promise<InboxOutboxTransportEvent[]> {

    let events = [];

    await this.dataSource.transaction(async (transactionalEntityManager) => {
      const now = new Date();
      
      events = await transactionalEntityManager.find(TypeOrmInboxOutboxTransportEvent, {
        where: {
          readyToRetryAfter: LessThanOrEqual(now.getTime())
        },
        take: limit,
        lock: { mode: 'pessimistic_write' } // Lock mode for pessimistic write
      });
  
      events.forEach(event => {
        const eventConfig = this.eventConfigurationResolver.resolve(event.eventName);
        event.readyToRetryAfter = new Date(now.getTime() + eventConfig.listeners.readyToRetryAfterTTL).getTime();
      });
  
      await transactionalEntityManager.save(events); 
    });
    
    return events;

  }

  async persist<T extends Object>(entity: T): Promise<void> {
    this.entitiesToPersist.push(entity);
  }

  async remove<T extends Object>(entity: T): Promise<void> {
    this.enetitiesToRemove.push(entity);
  }

  async flush(): Promise<void> {
    await this.dataSource.transaction(async (transactionalEntityManager) => {
      await transactionalEntityManager.save(this.entitiesToPersist);
      await transactionalEntityManager.remove(this.enetitiesToRemove);
    });

    this.entitiesToPersist = [];
    this.enetitiesToRemove = [];
  }

  createInboxOutboxTransportEvent(eventName: string, eventPayload: any, expireAt: number, readyToRetryAfter: number | null): InboxOutboxTransportEvent {
    return new TypeOrmInboxOutboxTransportEvent().create(eventName, eventPayload, expireAt, readyToRetryAfter);
  }
}
