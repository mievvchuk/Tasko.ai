import { createTotpSecret, createTotpUri, verifyTotp } from './totp.js';

describe('TOTP', () => {
  it('verifies a standard RFC 6238 code', () => {
    const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

    expect(verifyTotp(secret, '287082', 59_000)).toBe(true);
    expect(verifyTotp(secret, '000000', 59_000)).toBe(false);
  });

  it('creates a secret and an authenticator URI', () => {
    const secret = createTotpSecret();
    const uri = createTotpUri('student@example.com', secret);

    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(uri).toContain('otpauth://totp/Tasko.ai%3Astudent%40example.com');
    expect(uri).toContain(`secret=${secret}`);
    expect(uri).toContain('issuer=Tasko.ai');
  });

  it('rejects a code with an invalid format', () => {
    expect(verifyTotp('JBSWY3DPEHPK3PXP', '12a456')).toBe(false);
  });
});
