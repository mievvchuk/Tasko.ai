#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/9bcae3790fa8964b13476b349d05218944db2b2177f09400bbc898e9c176f1cd/contract';
import startContract from '../../snapshots/9bcae3790fa8964b13476b349d05218944db2b2177f09400bbc898e9c176f1cd/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/ec8f65b76eb7d99539b0b12d6c15235dd7d29dffdfd98709152e1c767c28cd11/contract';
import endContract from '../../snapshots/ec8f65b76eb7d99539b0b12d6c15235dd7d29dffdfd98709152e1c767c28cd11/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'User',
        column: col('googleId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.dropNotNull({ schema: 'public', table: 'User', column: 'passwordHash' }),
      this.addUnique({
        schema: 'public',
        table: 'User',
        constraint: 'User_googleId_key',
        columns: ['googleId'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
