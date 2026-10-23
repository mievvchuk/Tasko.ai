import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function createTotpSecret() {
  return toBase32(randomBytes(20));
}

export function createTotpUri(email: string, secret: string) {
  const account = encodeURIComponent(`Tasko.ai:${email}`);
  return `otpauth://totp/${account}?secret=${secret}&issuer=Tasko.ai&algorithm=SHA1&digits=6&period=30`;
}

export function verifyTotp(secret: string, code: string, now = Date.now()) {
  if (!/^\d{6}$/.test(code)) return false;
  const counter = Math.floor(now / 30000);
  for (let offset = -1; offset <= 1; offset += 1) {
    const expected = totp(secret, counter + offset);
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(code))) return true;
  }
  return false;
}

function totp(secret: string, counter: number) {
  const value = Buffer.alloc(8);
  value.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', fromBase32(secret)).update(value).digest();
  const offset = digest[digest.length - 1] & 15;
  const number =
    (((digest[offset] & 127) << 24) |
      ((digest[offset + 1] & 255) << 16) |
      ((digest[offset + 2] & 255) << 8) |
      (digest[offset + 3] & 255)) %
    1_000_000;
  return number.toString().padStart(6, '0');
}

function toBase32(value: Buffer) {
  let bits = '';
  for (const byte of value) bits += byte.toString(2).padStart(8, '0');
  let result = '';
  for (let index = 0; index < bits.length; index += 5) {
    result +=
      alphabet[Number.parseInt(bits.slice(index, index + 5).padEnd(5, '0'), 2)];
  }
  return result;
}

function fromBase32(value: string) {
  let bits = '';
  for (const character of value.toUpperCase()) {
    const index = alphabet.indexOf(character);
    if (index === -1) throw new Error('Некоректний секрет 2FA.');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}
