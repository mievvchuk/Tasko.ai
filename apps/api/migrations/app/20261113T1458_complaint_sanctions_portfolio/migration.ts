#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/1c435a1bc70db02fdbe8c52cc507d8b4709ff125683119293bec16390b15efca/contract';
import endContract from '../../snapshots/1c435a1bc70db02fdbe8c52cc507d8b4709ff125683119293bec16390b15efca/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/1d24cef48f5655f451b9203f4bead44538d7f677abe3f5be85ee4ea6f0a8af02/contract';
import startContract from '../../snapshots/1d24cef48f5655f451b9203f4bead44538d7f677abe3f5be85ee4ea6f0a8af02/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'Complaint',
        column: col('action', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Complaint',
        column: col('category', 'text', {
          notNull: true,
          default: lit('OTHER'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Complaint',
        column: col('restrictDays', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'PortfolioItem',
        column: col('imageUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'PortfolioItem',
        column: col('tags', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'User',
        column: col('restrictedUntil', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-date@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'User',
        column: col('restrictionReason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.dropNotNull({ schema: 'public', table: 'PortfolioItem', column: 'url' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
