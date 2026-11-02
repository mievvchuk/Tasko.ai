import { hashPassword, verifyPassword } from './password.js';

describe('password hashing', () => {
  it('hashes the password with a different salt each time', async () => {
    const first = await hashPassword('Coursework-test-123');
    const second = await hashPassword('Coursework-test-123');
    expect(first).not.toBe(second);
    expect(first).not.toContain('Coursework-test-123');
    expect(await verifyPassword('Coursework-test-123', first)).toBe(true);
    expect(await verifyPassword('wrong-password', first)).toBe(false);
  });
  it.each([
    'invalid',
    'scrypt:abc:def',
    '',
    'scrypt:' + 'a'.repeat(32) + ':' + 'z'.repeat(128),
  ])('rejects malformed hashes', async (hash) => {
    expect(await verifyPassword('password', hash)).toBe(false);
  });
});
