# InboxOutboxModule intro

The `InboxOutboxModule` is solution designed for NestJS to tackle the challenges of dual write and reliable event delivery in distributed systems. It addresses scenarios where one module emits an integration event, and another module must receive and process this information to maintain system-wide data consistency, which is not possible with a in-memory event bus.

## Outbox Part Visualization
![outbox](https://github.com/user-attachments/assets/680ee8e7-4ebc-423b-a64f-02d44524044b)

## Inbox Part Visualization
![inbox](https://github.com/user-attachments/assets/b59a065d-84ca-44ac-aed0-d66ea4485ae2)


### Problems Addressed

1. **Dual Write Consistency**: Ensures that database updates and event emissions are atomic, preventing scenarios where data is updated but the corresponding event fails to emit (or vice versa).

2. **Reliable Event Delivery**: Guarantees that events are delivered to their intended recipients, even in the face of temporary network issues, errors or service downtime/crash.

3. **Cross-Module Consistency**: Facilitates keeping data consistent across different modules or microservices by ensuring that all relevant parts of the system are updated based on emitted events.


## Implementation Guide

### Event Implementation

```typescript
import { InboxOutboxEvent } from '@nestixis/inbox-outbox';

export class UserApplicationAssignedEvent implements InboxOutboxEvent {
  public readonly name = UserApplicationAssignedEvent.name;

  constructor(
    public readonly userToken: string,
    public readonly applicationToken: string,
    public readonly userApplicationToken: string,
  ) {}
}
```


### Event Listener Implementation

**Decorator Usage:** To listen for an event, apply the `@Listener` decorator to a class method, referencing the specific event's name.
  ```typescript
  import { Listener } from '@nestixis/inbox-outbox';

  @Listener(UserApplicationAssignedEvent.name)
  ```
**Interface Implementation:** Implement the `IListener<T>` interface to define the listener's behavior for the corresponding event.
  ```typescript

  import { IListener } from '@nestixis/inbox-outbox';

  class EmitIntegrationEventOnUserApplicationUpdateListener implements IListener<UserApplicationAssignedEvent> {
    // Implementation details...
  }
  ```

Or in case when you want to listen to multiple events:

```typescript
import { Listener, IListener } from '@nestixis/inbox-outbox';

@Listener([
  UserApplicationAssignedEvent.name,
  UserApplicationAssigningEvent.name,
])
export class EmitIntegrationEventOnUserApplicationUpdateListener
  implements
    IListener<
    | UserApplicationAssignedEvent 
    | UserApplicationAssigningEvent
    >
{
  constructor(
    private eventEmitter: EventEmitter2,
    private queryBus: QueryBus,
  ) {}

  async handle(
    event:
      | UserApplicationAssignedEvent
      | UserApplicationAssigningEvent
  ): Promise<void> {
    // Implementation details...
  }
}
```
> **Note:** You should only group events that are related to each other (By case and data) in the same listener. If you have events that are not related to each other, you should create a separate listener for each event.

### Event Emission


The module uses a `TransactionalEventEmitter` for reliable event emission. This component is designed to work similarly to eventemitter2, but with added transactional capabilities.


1. **Transactional Emission:** The `TransactionalEventEmitter` takes two arguments:
   - The event to be emitted
   - An array of entities to be saved or removed in the transaction

2. **Immediate Delivery Attempt:** Upon emission, the system immediately tries to deliver the event to registered listeners.

3. **Fallback Mechanism:** If immediate delivery fails (due to network issues, service unavailability, etc.), a built-in polling mechanism ensures eventual delivery.


####  By doing that we are achieving the following:
- Events are only emitted if the associated database transaction succeeds.
- Even if immediate delivery fails, the event will eventually be processed.


- **Emitting an Event:** To emit an event, use the `emit` method of the `transactionalEventEmitter`, providing the event object and associated transactional entities. *Operation has to be awaited.*
  ```typescript
  import { TransactionalEventEmitterOperations, transactionalEventEmitter } from '@nestixis/inbox-outbox';

  constructor(private readonly transactionalEventEmitter: TransactionalEventEmitter) {}

  await this.transactionalEventEmitter.emit(
    new UserApplicationAssignedEvent(user.token, application.token, userApplication.token),
    [{
      entity: userApplication,
      operation: TransactionalEventEmitterOperations.persist,
    }]
  );
  ```
- **Event Contract:** Ensure that your event classes implement the `InboxOutboxEvent` interface for consistency and clarity.

### Module Registration

#### Options for Registration
- **expiresAtTTL**: This is how long the event will be stored in the database and will be retried
- **maxExecutionTimeTTL**: This is how long it will wait for the listener to process the event, if it takes longer than this, it will be retried
- **readyToRetryAfterTTL**: This is how long it will wait before retrying the event listeners
- **retryEveryMilliseconds**: This is how often it will check for events that need to be retried
- **maxInboxOutboxTransportEventPerRetry**: This is how many events it will retry at a time

#### Registration
- Register the `InboxOutboxModule` within your application's bootstrap process, specifying global accessibility and event configurations.
  ```typescript
   InboxOutboxModule.registerAsync({
      isGlobal: true,
      imports: [
        TypeOrmModule.forFeature([TypeOrmInboxOutboxTransportEvent, Cat]),
      ],
      useFactory: (dataSource: DataSource) => {
        const driverFactory = new TypeORMDatabaseDriverFactory(dataSource);
        return {
          driverFactory: driverFactory,
          events: [
            {
              name: UserApplicationAssignedEvent.name,
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
  ```

### Currently supported drivers
- [TypeORM](https://github.com/Nestixis/nestjs-inbox-outbox/tree/main/packages/typeorm-driver)
- [MikroORM](https://github.com/Nestixis/nestjs-inbox-outbox/tree/main/packages/mikroorm-driver)


## Creating a New Driver

To extend the InboxOutboxModule with support for additional ORMs or databases, you can create a new driver. Follow these steps to implement and integrate your custom driver:

### 1. Fork the Repository
Begin by forking the main InboxOutboxModule repository to your own GitHub account.

### 2. Create a New Package
Use Lerna to create a new package in the `packages` folder:
```bash
lerna create @nestixis/your-orm-driver
```
Alternatively, you can copy an existing driver package and modify it.

### 3. Implement the DatabaseDriver Interface
Develop your driver by implementing the `DatabaseDriver` interface. Pay special attention to:
- Transaction handling
- Pessimistic locking mechanisms
- Persist and flush operations

These aspects are crucial for maintaining data consistency and performance.

### 4. Implement the DatabaseDriverFactory Interface
Create a factory class that implements the `DatabaseDriverFactory` interface. This factory will be responsible for instantiating your custom driver.

### 5. Create a Persistable Model
Create a model that can be persisted in your target database. This model shall implement the `InboxOutboxTransportEvent` interface.

### 6. Develop a Proof of Concept
Create a demo application that utilizes your new driver. This PoC will serve as both a testing ground and an example for other developers.

### 7. Contribute or Publish
You have two options for making your driver available:
- Create a Pull Request to the main InboxOutboxModule repository for inclusion in the official release.
- Publish your driver to npm under your own namespace.

### Best Practices
- Ensure comprehensive test coverage for your driver.
- Document any database-specific considerations or configurations.
- Follow the coding standards and conventions established in the existing drivers.
- Consider performance implications, especially for high-throughput systems.


