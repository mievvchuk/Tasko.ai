import { BadRequestException } from '@nestjs/common';
import { strToU8, zipSync } from 'fflate';
import {
  extractAttachment,
  extractAttachments,
  maxAttachmentChars,
  maxTotalAttachmentChars,
} from './attachments.js';
import { withAttachments } from './agent.service.js';

function file(name: string, content: Buffer | string) {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
  return { originalname: name, mimetype: '', size: buffer.length, buffer };
}

// Мінімальний коректний PDF з одним рядком тексту (з правильною таблицею xref)
function pdfWith(text: string) {
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets = objects.map((object, index) => {
    const offset = body.length;
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('');
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body, 'latin1');
}

describe('AI chat attachments', () => {
  it('reads UTF-8 text files and rejects other encodings', async () => {
    const result = await extractAttachment(file('ТЗ.txt', 'Потрібен лендінг'));
    expect(result).toEqual({
      name: 'ТЗ.txt',
      text: 'Потрібен лендінг',
      truncated: false,
    });
    await expect(
      extractAttachment(file('old.txt', Buffer.from([0xcf, 0xf0, 0xe8]))),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reads paragraphs from a DOCX document', async () => {
    const docx = zipSync({
      'word/document.xml': strToU8(
        '<w:document><w:body><w:p><w:r><w:t>Етап 1 &amp; дизайн</w:t></w:r></w:p>' +
          '<w:p><w:r><w:t>Етап 2</w:t></w:r></w:p></w:body></w:document>',
      ),
    });
    const result = await extractAttachment(
      file('brief.docx', Buffer.from(docx)),
    );
    expect(result.text).toBe('Етап 1 & дизайн\nЕтап 2');
  });

  it('reads text from a PDF document', async () => {
    const result = await extractAttachment(
      file('spec.pdf', pdfWith('Hello Tasko')),
    );
    expect(result.text).toContain('Hello Tasko');
  });

  it('rejects files whose content does not match the extension', async () => {
    for (const fake of [
      file('spec.pdf', '<html>not a pdf</html>'),
      file('brief.docx', 'MZ executable'),
      file('photo.png', 'png'),
      file('empty.txt', ''),
    ])
      await expect(extractAttachment(fake)).rejects.toBeInstanceOf(
        BadRequestException,
      );
  });

  it('truncates long text and limits the number of files', async () => {
    const long = await extractAttachment(
      file('long.txt', 'а'.repeat(maxAttachmentChars + 50)),
    );
    expect(long.text).toHaveLength(maxAttachmentChars);
    expect(long.truncated).toBe(true);
    await expect(
      extractAttachments([1, 2, 3, 4].map((n) => file(`${n}.txt`, 'текст'))),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('wraps attachments as clearly marked data within the total budget', () => {
    const message = withAttachments('Перевір ТЗ', [
      { name: 'план.md', text: 'x'.repeat(maxAttachmentChars) },
      { name: 'бриф.md', text: 'y'.repeat(maxAttachmentChars) },
    ]);
    expect(message.startsWith('Перевір ТЗ')).toBe(true);
    expect(message).toContain('<<<ФАЙЛ «план.md»>>>');
    expect(message).toContain('<<<ФАЙЛ «бриф.md» (обрізано)>>>');
    expect(message.match(/[xy]/g)).toHaveLength(maxTotalAttachmentChars);
    expect(withAttachments('Без файлів', [])).toBe('Без файлів');
  });
});
