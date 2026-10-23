#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/58be3beca77a8fd367901d689a894d551d69a00800be78f6aa052d7e63138168/contract';
import endContract from '../../snapshots/58be3beca77a8fd367901d689a894d551d69a00800be78f6aa052d7e63138168/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/eabf8094c15d519dd5dd446126c4c73344ac97ceb018833f3e51d62431a193a7/contract';
import startContract from '../../snapshots/eabf8094c15d519dd5dd446126c4c73344ac97ceb018833f3e51d62431a193a7/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'FileAttachment',
        column: col('submissionId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.createIndex({
        schema: 'public',
        table: 'FileAttachment',
        index: 'FileAttachment_submissionId_idx_89cd3f4e',
        columns: ['submissionId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'FileAttachment',
        foreignKey: {
          name: 'FileAttachment_submissionId_fkey',
          columns: ['submissionId'],
          references: { schema: 'public', table: 'WorkSubmission', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
