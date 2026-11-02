import { validateFile } from './files.service.js';

describe('file validation', () => {
  it('accepts UTF-8 text and computes the MIME type itself', () => {
    const buffer = Buffer.from('Результат роботи');
    expect(
      validateFile({
        originalname: 'result.txt',
        mimetype: 'application/octet-stream',
        buffer,
        size: buffer.length,
      }),
    ).toEqual({ extension: '.txt', mime: 'text/plain' });
  });
  it('rejects executable files and renamed executable content', () => {
    const buffer = Buffer.from('MZ-executable');
    expect(() =>
      validateFile({
        originalname: 'result.exe',
        mimetype: 'text/plain',
        buffer,
        size: buffer.length,
      }),
    ).toThrow();
    expect(() =>
      validateFile({
        originalname: 'result.pdf',
        mimetype: 'application/pdf',
        buffer,
        size: buffer.length,
      }),
    ).toThrow();
  });
  it('rejects empty, oversized and invalid UTF-8 files', () => {
    expect(() =>
      validateFile({
        originalname: 'result.txt',
        mimetype: 'text/plain',
        buffer: Buffer.alloc(0),
        size: 0,
      }),
    ).toThrow();
    const large = Buffer.alloc(10 * 1024 * 1024 + 1);
    expect(() =>
      validateFile({
        originalname: 'result.txt',
        mimetype: 'text/plain',
        buffer: large,
        size: large.length,
      }),
    ).toThrow();
    expect(() =>
      validateFile({
        originalname: 'result.txt',
        mimetype: 'text/plain',
        buffer: Buffer.from([0xff]),
        size: 1,
      }),
    ).toThrow();
  });
});
