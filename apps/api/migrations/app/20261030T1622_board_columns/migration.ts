#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/5d76149811f7c7a74dd59835f0bff27e565335afc1c6fd677386a7e87d67503f/contract';
import endContract from '../../snapshots/5d76149811f7c7a74dd59835f0bff27e565335afc1c6fd677386a7e87d67503f/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/734b1b50f61d2d75260e6c886fbd441cfe63e456ee5406f63679e2846b0f5942/contract';
import startContract from '../../snapshots/734b1b50f61d2d75260e6c886fbd441cfe63e456ee5406f63679e2846b0f5942/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'BoardColumn',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('position', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('projectId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'Task',
        column: col('columnId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'BoardColumn',
        constraint: 'BoardColumn_projectId_position_key',
        columns: ['projectId', 'position'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'BoardColumn',
        index: 'BoardColumn_projectId_idx_a96e4d92',
        columns: ['projectId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Task',
        index: 'Task_columnId_idx_728f084b',
        columns: ['columnId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'BoardColumn',
        foreignKey: {
          name: 'BoardColumn_projectId_fkey',
          columns: ['projectId'],
          references: { schema: 'public', table: 'Project', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Task',
        foreignKey: {
          name: 'Task_columnId_fkey',
          columns: ['columnId'],
          references: { schema: 'public', table: 'BoardColumn', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
