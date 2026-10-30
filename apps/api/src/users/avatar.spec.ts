import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import { maxAvatarSize, validateAvatar } from './avatar.js';
import { UsersService } from './users.service.js';

function upload(bytes: number[] | Buffer, name = 'photo.png') {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  return {
    originalname: name,
    mimetype: 'image/png',
    size: buffer.length,
    buffer,
  };
}

describe('Avatar validation', () => {
  it('detects PNG, JPG and WEBP by their content', () => {
    expect(
      validateAvatar(upload([137, 80, 78, 71, 13, 10, 26, 10, 0])).extension,
    ).toBe('png');
    expect(validateAvatar(upload([0xff, 0xd8, 0xff, 0xe0])).extension).toBe(
      'jpg',
    );
    expect(
      validateAvatar(upload(Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'latin1')))
        .extension,
    ).toBe('webp');
  });

  it('rejects HTML disguised as an image', () => {
    expect(() =>
      validateAvatar(upload(Buffer.from('<script>alert(1)</script>'))),
    ).toThrow(BadRequestException);
  });

  it('rejects missing, empty and oversized files', () => {
    expect(() => validateAvatar(undefined)).toThrow(BadRequestException);
    expect(() => validateAvatar(upload([]))).toThrow(BadRequestException);
    const big = Buffer.alloc(maxAvatarSize + 1);
    big.set([0xff, 0xd8, 0xff]);
    expect(() => validateAvatar(upload(big))).toThrow(BadRequestException);
  });

  it('serves only generated avatar file names', async () => {
    const service = new UsersService({} as PrismaService);
    for (const name of [
      '../../.env',
      '..%2F.env',
      'photo.png',
      'd3e00000-0000-4000-8000-000000000001.svg',
    ])
      await expect(service.avatarFile(name)).rejects.toBeInstanceOf(
        NotFoundException,
      );
  });
});
