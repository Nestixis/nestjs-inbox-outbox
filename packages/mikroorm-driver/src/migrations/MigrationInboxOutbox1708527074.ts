import { Migration } from '@mikro-orm/migrations';

export class MigrationInboxOutbox1708527074 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      this.getKnex()
        .schema.createTable('inbox_outbox_transport_event', (table) => {
          table.bigIncrements('id').primary();
          table.string('event_name').notNullable();
          table.json('event_payload').notNullable();
          table.json('delived_to_listeners').notNullable();
          table.bigInteger('ready_to_retry_after').nullable();
          table.bigInteger('expire_at').notNullable();
          table.bigInteger('inserted_at').notNullable();
        })
        .toQuery(),
    );
  }
} //