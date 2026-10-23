import { validate } from 'class-validator';
import { loadConfig } from '../config/config.js';
import { createDb } from '../prisma/db.js';
import { hashPassword } from '../auth/password.js';
import { randomUUID } from 'node:crypto';
import { RegisterDto } from '../auth/auth.dto.js';

const config = loadConfig();
const input = Object.assign(new RegisterDto(), {
  name: process.env.ADMIN_NAME?.trim(),
  email: process.env.ADMIN_EMAIL?.trim().toLowerCase(),
  password: process.env.ADMIN_PASSWORD,
  role: 'CLIENT',
});
if ((await validate(input)).length)
  throw new Error(
    'Вкажіть коректні ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD у локальному .env.',
  );
const db = createDb(config.databaseUrl);
try {
  if (await db.orm.public.User.where({ email: input.email }).first())
    throw new Error(
      'Користувач із цією поштою вже існує. Роль автоматично не змінюється.',
    );
  const now = new Date();
  await db.orm.public.User.create({
    id: randomUUID(),
    name: input.name,
    email: input.email,
    passwordHash: await hashPassword(input.password),
    role: 'ADMIN',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  });
  console.log('Адміністратора створено.');
} finally {
  await db.close();
}
