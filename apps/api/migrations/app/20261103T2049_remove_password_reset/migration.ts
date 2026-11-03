#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/1647d55c25447f3a775fc4c60b517cc1c317f1a5cbd79704624ba19135bfc91c/contract';
import endContract from '../../snapshots/1647d55c25447f3a775fc4c60b517cc1c317f1a5cbd79704624ba19135bfc91c/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/36103268da77cf79b55af2416ac520b03e53b547b21674b363746ec60ad9374b/contract';
import startContract from '../../snapshots/36103268da77cf79b55af2416ac520b03e53b547b21674b363746ec60ad9374b/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropTable({ schema: 'public', table: 'EmailVerificationToken' }),
      this.dropTable({ schema: 'public', table: 'PasswordResetToken' }),
      this.dropColumn({ schema: 'public', table: 'User', column: 'emailVerifiedAt' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
