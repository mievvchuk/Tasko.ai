#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/734b1b50f61d2d75260e6c886fbd441cfe63e456ee5406f63679e2846b0f5942/contract';
import endContract from '../../snapshots/734b1b50f61d2d75260e6c886fbd441cfe63e456ee5406f63679e2846b0f5942/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/dad8622b20e44c39c68c16107f17ade576f98e5e573f58e086804d53427abc0a/contract';
import startContract from '../../snapshots/dad8622b20e44c39c68c16107f17ade576f98e5e573f58e086804d53427abc0a/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'User',
        column: col('avatarUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
