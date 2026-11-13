#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/32f0bb3ec8d3d2716d3b68b650116c0fda5d6b3a477498ecc39c013f6a8b3139/contract';
import endContract from '../../snapshots/32f0bb3ec8d3d2716d3b68b650116c0fda5d6b3a477498ecc39c013f6a8b3139/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/660f56e8093469123a97f93917eee71c2984bb62f03cf1b0c1cd13847e9751f9/contract';
import startContract from '../../snapshots/660f56e8093469123a97f93917eee71c2984bb62f03cf1b0c1cd13847e9751f9/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'User',
        column: col('blockReason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
