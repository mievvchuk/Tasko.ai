#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/660f56e8093469123a97f93917eee71c2984bb62f03cf1b0c1cd13847e9751f9/contract';
import endContract from '../../snapshots/660f56e8093469123a97f93917eee71c2984bb62f03cf1b0c1cd13847e9751f9/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/ec8f65b76eb7d99539b0b12d6c15235dd7d29dffdfd98709152e1c767c28cd11/contract';
import startContract from '../../snapshots/ec8f65b76eb7d99539b0b12d6c15235dd7d29dffdfd98709152e1c767c28cd11/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'Order',
        column: col('amount', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Order',
        column: col('deadline', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-date@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Order',
        column: col('freelancerId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
