import { BadGatewayException } from '@nestjs/common';
import { parseApplicationRanking } from './application-ranking.js';

describe('parseApplicationRanking', () => {
  const ids = ['a', 'b'];

  it('accepts every allowed application exactly once', () => {
    expect(
      parseApplicationRanking(
        '[{"applicationId":"a","score":90,"reason":"Добрий досвід"},{"applicationId":"b","score":70,"reason":"Підходять навички"}]',
        ids,
      ),
    ).toHaveLength(2);
  });

  it.each([
    'not-json',
    '[]',
    '[{"applicationId":"a","score":101,"reason":"x"},{"applicationId":"b","score":1,"reason":"x"}]',
    '[{"applicationId":"a","score":50,"reason":"x"},{"applicationId":"a","score":40,"reason":"x"}]',
  ])('rejects unsafe provider output', (value) => {
    expect(() => parseApplicationRanking(value, ids)).toThrow(
      BadGatewayException,
    );
  });
});
