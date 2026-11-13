#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/1c435a1bc70db02fdbe8c52cc507d8b4709ff125683119293bec16390b15efca/contract';
import startContract from '../../snapshots/1c435a1bc70db02fdbe8c52cc507d8b4709ff125683119293bec16390b15efca/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/b8833235147ef12361380a18dc8778d798e37cc11bb43d7d688b685a7c43d15f/contract';
import endContract from '../../snapshots/b8833235147ef12361380a18dc8778d798e37cc11bb43d7d688b685a7c43d15f/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'Notification',
        column: col('applicationId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
