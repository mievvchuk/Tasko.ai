import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from './contract.d.js';
import contractJson from './contract.json' with { type: 'json' };

export function createDb(databaseUrl: string) {
  return postgres<Contract>({
    contractJson,
    url: databaseUrl,
    poolOptions: { connectionTimeoutMillis: 5000 },
  });
}
