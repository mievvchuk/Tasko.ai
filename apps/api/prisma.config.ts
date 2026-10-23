import { loadEnvironment } from './src/config/config.js';
import { definePrismaConfig } from '@prisma/cli-engine';
import { defineConfig as ormConfig } from '@prisma/orm-postgres/config';
import { fileURLToPath } from 'node:url';

loadEnvironment();

const orm = ormConfig({
  contract: './src/prisma/contract.prisma',
  db: {
    connection: process.env['DATABASE_URL']!,
  },
});
const source = orm.contract.source;
// This project has one literal schema file. Avoid treating parentheses in the
// Windows checkout path as glob syntax in the Prisma 8 RC source resolver.
export default definePrismaConfig({
  orm: {
    ...orm,
    contract: {
      ...orm.contract,
      source: {
        ...source,
        inputs: [],
        load: (context) =>
          source.load({
            ...context,
            resolvedInputs: [
              fileURLToPath(
                new URL('./src/prisma/contract.prisma', import.meta.url),
              ),
            ],
          }),
      },
    },
  },
});
