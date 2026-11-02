import { BadGatewayException } from '@nestjs/common';

export interface ApplicationRanking {
  applicationId: string;
  score: number;
  reason: string;
}

export function parseApplicationRanking(value: string, allowedIds: string[]) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value.replace(/^```json\s*|```$/g, '').trim());
  } catch {
    throw new BadGatewayException('AI повернув некоректний рейтинг заявок.');
  }
  if (!Array.isArray(parsed) || parsed.length !== allowedIds.length)
    throw new BadGatewayException('AI повернув неповний рейтинг заявок.');
  const result: ApplicationRanking[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object')
      throw new BadGatewayException('AI повернув некоректний рейтинг заявок.');
    const row = item as Record<string, unknown>;
    if (
      typeof row.applicationId !== 'string' ||
      !allowedIds.includes(row.applicationId) ||
      typeof row.score !== 'number' ||
      !Number.isInteger(row.score) ||
      row.score < 0 ||
      row.score > 100 ||
      typeof row.reason !== 'string' ||
      !row.reason.trim() ||
      row.reason.length > 500
    )
      throw new BadGatewayException('AI повернув некоректний рейтинг заявок.');
    result.push({
      applicationId: row.applicationId,
      score: row.score,
      reason: row.reason.trim(),
    });
  }
  if (
    new Set(result.map((item) => item.applicationId)).size !== allowedIds.length
  )
    throw new BadGatewayException('AI повернув повторені або невідомі заявки.');
  return result;
}
