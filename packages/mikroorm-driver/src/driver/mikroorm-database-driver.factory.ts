import { MikroORM } from '@mikro-orm/core';
import { DatabaseDriver, EventConfigurationResolverContract } from '@nestixis/nestjs-inbox-outbox';
import { MikroORMDatabaseDriver } from './mikroorm.database-driver';
  
export class MikroORMDatabaseDriverFactory {
  constructor(private readonly orm: MikroORM) {}

 create(eventConfigurationResolver: EventConfigurationResolverContract): DatabaseDriver {
    const forkedEm = this.orm.em.fork();
    return new MikroORMDatabaseDriver(forkedEm, eventConfigurationResolver);
  }
}
