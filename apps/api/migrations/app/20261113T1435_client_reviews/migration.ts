#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/1d24cef48f5655f451b9203f4bead44538d7f677abe3f5be85ee4ea6f0a8af02/contract';
import endContract from '../../snapshots/1d24cef48f5655f451b9203f4bead44538d7f677abe3f5be85ee4ea6f0a8af02/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/32f0bb3ec8d3d2716d3b68b650116c0fda5d6b3a477498ecc39c013f6a8b3139/contract';
import startContract from '../../snapshots/32f0bb3ec8d3d2716d3b68b650116c0fda5d6b3a477498ecc39c013f6a8b3139/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'ClientReview',
        columns: [
          col('clientId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('comment', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('freelancerId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('projectId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('rating', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'ClientReview',
        constraint: 'ClientReview_projectId_freelancerId_key',
        columns: ['projectId', 'freelancerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ClientReview',
        index: 'ClientReview_clientId_idx_153a9a49',
        columns: ['clientId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ClientReview',
        index: 'ClientReview_freelancerId_idx_c8137280',
        columns: ['freelancerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ClientReview',
        index: 'ClientReview_projectId_idx_a96e4d92',
        columns: ['projectId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ClientReview',
        foreignKey: {
          name: 'ClientReview_projectId_fkey',
          columns: ['projectId'],
          references: { schema: 'public', table: 'Project', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ClientReview',
        foreignKey: {
          name: 'ClientReview_clientId_fkey',
          columns: ['clientId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ClientReview',
        foreignKey: {
          name: 'ClientReview_freelancerId_fkey',
          columns: ['freelancerId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
