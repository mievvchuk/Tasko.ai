import { randomUUID, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { loadConfig } from '../dist/config/config.js';
import { createDb } from '../dist/prisma/db.js';
import { hashPassword } from '../dist/auth/password.js';

const directory = new URL('../../../.tmp/', import.meta.url);
const destination = new URL('final-admin.json', directory);
const db = createDb(loadConfig().databaseUrl);
try {
  await mkdir(directory, { recursive: true });
  let existing;
  try {
    existing = JSON.parse(await readFile(destination, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (existing) {
    const user = await db.orm.public.User.where({ id: existing.id })
      .select('email', 'role', 'status')
      .first();
    if (
      !user ||
      user.email !== existing.email ||
      user.role !== 'ADMIN' ||
      user.status !== 'ACTIVE'
    )
      throw new Error(
        'Збережений тестовий адміністратор недоступний. Перевірте .tmp/final-admin.json та відповідну локальну БД.',
      );
    console.log('Existing isolated admin fixture is ready.');
  } else {
    const account = {
      id: randomUUID(),
      name: 'Перевірка фінальної версії',
      email: `final-admin-${Date.now()}@example.com`,
      password: randomBytes(24).toString('base64url'),
    };
    const now = new Date();
    await db.orm.public.User.create({
      id: account.id,
      name: account.name,
      email: account.email,
      passwordHash: await hashPassword(account.password),
      role: 'ADMIN',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    });
    await writeFile(destination, JSON.stringify(account), { flag: 'wx' });
    console.log(
      'Isolated admin fixture created. Credentials saved only in ignored .tmp directory.',
    );
  }
} finally {
  await db.close();
}
