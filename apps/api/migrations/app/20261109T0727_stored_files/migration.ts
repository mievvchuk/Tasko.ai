#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/0e90408e916176318083817556d3fcf052d5296942d495ba28e0410d62fded15/contract';
import startContract from '../../snapshots/0e90408e916176318083817556d3fcf052d5296942d495ba28e0410d62fded15/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/ab1afb8068329f2a44043eb2be833f102b82f392472d850617d674edb1aaf4cf/contract';
import endContract from '../../snapshots/ab1afb8068329f2a44043eb2be833f102b82f392472d850617d674edb1aaf4cf/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'StoredFile',
        columns: [
          col('content', 'bytea', { notNull: true, codecRef: { codecId: 'pg/bytea@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
