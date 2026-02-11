import { DatabaseDriver, EventConfigurationResolverContract } from '@nestixis/nestjs-inbox-outbox';
import { PrismaClient } from '@generated-dev-prisma/client';
import { PrismaDatabaseDriver } from './prisma-database-driver';

export class PrismaDatabaseDriverFactory {
  constructor(private readonly prisma: PrismaClient) {}

  create(eventConfigurationResolver: EventConfigurationResolverContract): DatabaseDriver {
    return new PrismaDatabaseDriver(this.prisma, eventConfigurationResolver);
  }
}
