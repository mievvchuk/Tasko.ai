#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/b8833235147ef12361380a18dc8778d798e37cc11bb43d7d688b685a7c43d15f/contract';
import startContract from '../../snapshots/b8833235147ef12361380a18dc8778d798e37cc11bb43d7d688b685a7c43d15f/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e10247c796c41c4a7b8c356c6ec8957d636b81878de5d042ce7c6fad6104e125/contract';
import endContract from '../../snapshots/e10247c796c41c4a7b8c356c6ec8957d636b81878de5d042ce7c6fad6104e125/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'Task',
        column: col('milestoneId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.createIndex({
        schema: 'public',
        table: 'Task',
        index: 'Task_milestoneId_idx_f1dac854',
        columns: ['milestoneId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Task',
        foreignKey: {
          name: 'Task_milestoneId_fkey',
          columns: ['milestoneId'],
          references: { schema: 'public', table: 'ProjectMilestone', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
