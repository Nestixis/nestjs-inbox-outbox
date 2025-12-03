import { MigrationInterface, QueryRunner } from "typeorm";

export class MigrationInboxOutbox1733250000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.renameColumn(
      'inbox_outbox_transport_event',
      'delived_to_listeners',
      'delivered_to_listeners'
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.renameColumn(
      'inbox_outbox_transport_event',
      'delivered_to_listeners',
      'delived_to_listeners'
    );
  }
}
