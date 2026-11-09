#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/9bcae3790fa8964b13476b349d05218944db2b2177f09400bbc898e9c176f1cd/contract';
import endContract from '../../snapshots/9bcae3790fa8964b13476b349d05218944db2b2177f09400bbc898e9c176f1cd/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/ee2fb6a4ff5ea8a18141c1de10e085722df5b44b52c5e332c5fd98bce3b8d396/contract';
import startContract from '../../snapshots/ee2fb6a4ff5ea8a18141c1de10e085722df5b44b52c5e332c5fd98bce3b8d396/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'ApplicationMessage',
        columns: [
          col('applicationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('content', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('senderId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ApplicationMessage',
        index: 'ApplicationMessage_applicationId_idx_8158f91a',
        columns: ['applicationId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ApplicationMessage',
        foreignKey: {
          name: 'ApplicationMessage_applicationId_fkey',
          columns: ['applicationId'],
          references: { schema: 'public', table: 'ProjectApplication', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
