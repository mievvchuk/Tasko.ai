#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/58be3beca77a8fd367901d689a894d551d69a00800be78f6aa052d7e63138168/contract';
import startContract from '../../snapshots/58be3beca77a8fd367901d689a894d551d69a00800be78f6aa052d7e63138168/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/abe36e5e5e10cd10242f738b8f5dbece1b4c4643eea719529748a9fc2b6bd185/contract';
import endContract from '../../snapshots/abe36e5e5e10cd10242f738b8f5dbece1b4c4643eea719529748a9fc2b6bd185/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    // SQL-типи незмінні; міграція оновлює контракт для JavaScript Date.
    return [];
  }
}

MigrationCLI.run(import.meta.url, M);
