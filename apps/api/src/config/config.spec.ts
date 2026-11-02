import { readConfig } from './config.js';

const valid = {
  DATABASE_URL: 'postgresql://localhost/coursework_test',
  JWT_SECRET: 'a'.repeat(64),
};

describe('configuration', () => {
  it('requires complete SMTP configuration', () => {
    expect(() => readConfig({ ...valid, SMTP_HOST: 'smtp.gmail.com' })).toThrow(
      'SMTP_USER',
    );
  });
  it('defaults to Gmail TLS port when SMTP is configured', () => {
    const config = readConfig({
      ...valid,
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_USER: 'sender@gmail.com',
      SMTP_PASSWORD: 'test-only-password',
    });
    expect(config.smtpPort).toBe(465);
    expect(config.emailFrom).toBe('sender@gmail.com');
  });
  it('accepts PostgreSQL and uses the default port', () => {
    expect(readConfig(valid).port).toBe(3000);
  });
  it.each([undefined, '', 'https://localhost/db', 'invalid'])(
    'rejects an invalid database URL: %s',
    (DATABASE_URL) => {
      expect(() => readConfig({ ...valid, DATABASE_URL })).toThrow(
        'DATABASE_URL',
      );
    },
  );
  it.each([
    undefined,
    'short',
    'your_super_secret_jwt_key_here_change_in_production',
  ])('rejects an unsafe JWT secret', (JWT_SECRET) => {
    expect(() => readConfig({ ...valid, JWT_SECRET })).toThrow('JWT_SECRET');
  });
  it.each(['0', '-1', '65536', 'abc', '3.5'])(
    'rejects an invalid port: %s',
    (PORT) => {
      expect(() => readConfig({ ...valid, PORT })).toThrow('PORT');
    },
  );
});
