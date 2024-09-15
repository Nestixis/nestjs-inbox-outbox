import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class MigrationInboxOutbox1726154235704 implements MigrationInterface {
    name?: string;
    transaction?: boolean;
  
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(new Table({
            name: 'inbox_outbox_transport_event',
            columns: [
                {
                    name: 'id',
                    type: 'int',
                    isPrimary: true,
                    isGenerated: true,
                    generationStrategy: 'increment'
                },
                {
                    name: 'event_name',
                    type: 'varchar',
                    length: '255'
                },
                {
                    name: 'event_payload',
                    type: 'json'
                },
                {
                    name: 'expire_at',
                    type: 'bigint'
                },
                {
                    name: 'ready_to_retry_after',
                    type: 'bigint',
                    isNullable: true
                },
                {
                    name: 'inserted_at',
                    type: 'bigint'
                },
                {
                    name: 'delived_to_listeners',
                    type: 'json',
                }
            ]
    }));
    }

    async down(queryRunner: QueryRunner): Promise<void> {}
}