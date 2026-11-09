#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/ab1afb8068329f2a44043eb2be833f102b82f392472d850617d674edb1aaf4cf/contract';
import startContract from '../../snapshots/ab1afb8068329f2a44043eb2be833f102b82f392472d850617d674edb1aaf4cf/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/ee2fb6a4ff5ea8a18141c1de10e085722df5b44b52c5e332c5fd98bce3b8d396/contract';
import endContract from '../../snapshots/ee2fb6a4ff5ea8a18141c1de10e085722df5b44b52c5e332c5fd98bce3b8d396/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'Project',
        column: col('hiringOpen', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
