import { BadRequestException } from '@nestjs/common';
import type { UploadedFile } from '../collaboration/files.service.js';

export const maxAvatarSize = 2 * 1024 * 1024;

// Ім'я файлу фото в сховищі: випадковий UUID + розширення.
// Перевіряємо його і при збереженні посилання, і при віддачі файлу.
export const avatarFilePattern = /^[a-f0-9-]{36}\.(png|jpg|webp)$/;

const formats: {
  extension: 'png' | 'jpg' | 'webp';
  mime: string;
  matches: (bytes: Buffer) => boolean;
}[] = [
  {
    extension: 'png',
    mime: 'image/png',
    matches: (b) =>
      b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  },
  {
    extension: 'jpg',
    mime: 'image/jpeg',
    matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    extension: 'webp',
    mime: 'image/webp',
    matches: (b) =>
      b.subarray(0, 4).toString('latin1') === 'RIFF' &&
      b.subarray(8, 12).toString('latin1') === 'WEBP',
  },
];

// Тип фото визначаємо за вмістом (сигнатурою), а не за назвою чи заголовком,
// тож перейменований .exe чи HTML під виглядом картинки не пройде.
export function validateAvatar(file: UploadedFile | undefined) {
  if (!file) throw new BadRequestException('Додайте фото в поле file.');
  if (
    file.size === 0 ||
    file.size > maxAvatarSize ||
    file.size !== file.buffer.length
  )
    throw new BadRequestException('Фото має бути розміром до 2 МБ.');
  const format = formats.find((item) => item.matches(file.buffer));
  if (!format)
    throw new BadRequestException(
      'Дозволено фото у форматі PNG, JPG або WEBP.',
    );
  return format;
}

export function avatarMime(fileName: string) {
  const extension = fileName.split('.').pop();
  return formats.find((item) => item.extension === extension)?.mime;
}
