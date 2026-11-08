#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/0e90408e916176318083817556d3fcf052d5296942d495ba28e0410d62fded15/contract';
import endContract from '../../snapshots/0e90408e916176318083817556d3fcf052d5296942d495ba28e0410d62fded15/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/1647d55c25447f3a775fc4c60b517cc1c317f1a5cbd79704624ba19135bfc91c/contract';
import startContract from '../../snapshots/1647d55c25447f3a775fc4c60b517cc1c317f1a5cbd79704624ba19135bfc91c/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'Task',
        column: col('rating', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
