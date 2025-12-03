import { Migration } from '@mikro-orm/migrations';

export class MigrationInboxOutbox1733250000 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      this.getKnex()
        .schema.alterTable('inbox_outbox_transport_event', (table) => {
          table.renameColumn('delived_to_listeners', 'delivered_to_listeners');
        })
        .toQuery(),
    );
  }

  async down(): Promise<void> {
    this.addSql(
      this.getKnex()
        .schema.alterTable('inbox_outbox_transport_event', (table) => {
          table.renameColumn('delivered_to_listeners', 'delived_to_listeners');
        })
        .toQuery(),
    );
  }
}
