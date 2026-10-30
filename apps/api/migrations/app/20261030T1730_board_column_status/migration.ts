#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/36103268da77cf79b55af2416ac520b03e53b547b21674b363746ec60ad9374b/contract';
import endContract from '../../snapshots/36103268da77cf79b55af2416ac520b03e53b547b21674b363746ec60ad9374b/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/5d76149811f7c7a74dd59835f0bff27e565335afc1c6fd677386a7e87d67503f/contract';
import startContract from '../../snapshots/5d76149811f7c7a74dd59835f0bff27e565335afc1c6fd677386a7e87d67503f/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'BoardColumn',
        column: col('status', 'text', {
          notNull: true,
          default: lit('IN_PROGRESS'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
