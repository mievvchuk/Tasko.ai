import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { RegisterDto } from '../../../src/auth/auth.dto.js';
import { UpdateAccountDto } from '../../../src/users/users.dto.js';

const nameErrors = async (name: string) => {
  const errors = await validate(
    plainToInstance(RegisterDto, {
      name,
      email: 'person@example.com',
      password: 'password123',
      role: 'CLIENT',
    }),
  );
  return errors.filter((error) => error.property === 'name');
};

describe('імена без емодзі', () => {
  it.each(['Олена Коваль', "Анна-Марія О'Брайен", 'westik03', 'Ігор Бойко'])(
    'приймає «%s»',
    async (name) => expect(await nameErrors(name)).toHaveLength(0),
  );
  it.each(['🤯🤯🤯', 'Олена 😊', 'Іван 🇺🇦', 'Мак❤️с', 'Зірка ⭐'])(
    'відхиляє «%s»',
    async (name) => expect(await nameErrors(name)).not.toHaveLength(0),
  );
  it('перевіряє й зміну імені в профілі', async () => {
    const errors = await validate(
      plainToInstance(UpdateAccountDto, { name: 'Тест 🤯' }),
    );
    expect(errors).not.toHaveLength(0);
  });
});
