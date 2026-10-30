import { BadRequestException } from '@nestjs/common';
import { strFromU8, unzipSync } from 'fflate';
import { extractText, getDocumentProxy } from 'unpdf';
import type { UploadedFile } from '../collaboration/files.service.js';

// Матеріали до AI-чату не зберігаються: сервер лише витягує з файлу текст,
// а клієнт надсилає його разом із запитанням. Ліміти тримають запит у межах
// безкоштовного тарифу AI-провайдера.
export const maxAttachmentFiles = 3;
export const maxAttachmentSize = 5 * 1024 * 1024;
export const maxAttachmentChars = 10000;
export const maxTotalAttachmentChars = 15000;
// Захист від «zip-бомби»: DOCX, що розпаковується в гігабайти
const maxUnpackedDocx = 20 * 1024 * 1024;

export interface AttachmentText {
  name: string;
  text: string;
  truncated: boolean;
}

function cleanName(name: string) {
  return (
    Array.from(name.replaceAll('\\', '/').split('/').pop() ?? '')
      .filter((c) => c.charCodeAt(0) > 31 && c.charCodeAt(0) !== 127)
      .join('')
      .slice(0, 200) || 'файл'
  );
}

function decodeXml(text: string) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&amp;/g, '&');
}

// DOCX — це zip; основний текст лежить у word/document.xml
export function docxText(buffer: Buffer) {
  let tooBig = false;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(buffer), {
      filter: (entry) => {
        if (entry.name !== 'word/document.xml') return false;
        if (entry.originalSize > maxUnpackedDocx) tooBig = true;
        return !tooBig;
      },
    });
  } catch {
    throw new BadRequestException('Не вдалося прочитати DOCX-файл.');
  }
  if (tooBig) throw new BadRequestException('DOCX-файл завеликий для аналізу.');
  const xml = files['word/document.xml'];
  if (!xml) throw new BadRequestException('Це не документ Word (DOCX).');
  return decodeXml(
    strFromU8(xml)
      .replace(/<w:tab\/>/g, '\t')
      .replace(/<w:br\/>|<\/w:p>/g, '\n')
      .replace(/<[^>]+>/g, ''),
  );
}

async function pdfText(buffer: Buffer) {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } catch {
    throw new BadRequestException('Не вдалося прочитати PDF-файл.');
  }
}

function utf8Text(buffer: Buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw new BadRequestException('Текстовий файл має бути у UTF-8.');
  }
}

// Тип визначаємо за розширенням І вмістом: PDF починається з %PDF, DOCX — з PK
export async function extractAttachment(
  file: UploadedFile,
): Promise<AttachmentText> {
  const name = cleanName(file.originalname);
  const extension = name.toLowerCase().split('.').pop();
  if (file.size === 0 || file.size > maxAttachmentSize)
    throw new BadRequestException(`Файл «${name}» має бути до 5 МБ.`);
  let raw: string;
  if (extension === 'txt' || extension === 'md') raw = utf8Text(file.buffer);
  else if (
    extension === 'pdf' &&
    file.buffer.subarray(0, 4).toString('latin1') === '%PDF'
  )
    raw = await pdfText(file.buffer);
  else if (
    extension === 'docx' &&
    file.buffer[0] === 0x50 &&
    file.buffer[1] === 0x4b
  )
    raw = docxText(file.buffer);
  else
    throw new BadRequestException(
      `Файл «${name}»: дозволено лише TXT, PDF або DOCX.`,
    );
  // Прибираємо зайві пробіли й порожні рядки, щоб не витрачати ліміт моделі
  const text = raw
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!text)
    throw new BadRequestException(
      `У файлі «${name}» немає тексту (можливо, це скан).`,
    );
  return {
    name,
    text: text.slice(0, maxAttachmentChars),
    truncated: text.length > maxAttachmentChars,
  };
}

export async function extractAttachments(files: UploadedFile[] | undefined) {
  if (!files?.length)
    throw new BadRequestException('Додайте файл у поле files.');
  if (files.length > maxAttachmentFiles)
    throw new BadRequestException('Можна прикріпити до 3 файлів.');
  const result: AttachmentText[] = [];
  for (const file of files) result.push(await extractAttachment(file));
  return result;
}
