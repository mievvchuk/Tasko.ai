import { HttpException } from '@nestjs/common';
import type { Response } from 'express';

// Лічильник спроб у вікні часу для лімітів запитів.
// shortcut: живе в пам'яті одного процесу API; для кількох інстансів потрібен Redis
export class HitCounter {
  private readonly hits = new Map<string, { count: number; until: number }>();

  constructor(
    private readonly windowMs: number,
    private readonly maxKeys = 10000,
  ) {}

  // Зараховує спробу для всіх ключів або кидає 429, якщо будь-який ключ вичерпав ліміт.
  // Відхилений запит нічого не зараховує.
  hit(keys: [key: string, limit: number][], response: Response) {
    const now = Date.now();
    for (const [key, entry] of this.hits)
      if (entry.until <= now) this.hits.delete(key);
    for (const [key, limit] of keys) {
      const entry = this.hits.get(key);
      if (entry && entry.count >= limit) {
        response.setHeader('Retry-After', Math.ceil((entry.until - now) / 1000));
        throw new HttpException('Забагато спроб. Спробуйте пізніше.', 429);
      }
    }
    for (const [key] of keys) {
      const entry = this.hits.get(key);
      if (entry) {
        entry.count++;
        continue;
      }
      // Переповнена таблиця витісняє найстаріший запис, а не блокує всіх нових відвідувачів
      if (this.hits.size >= this.maxKeys)
        this.hits.delete(this.hits.keys().next().value!);
      this.hits.set(key, { count: 1, until: now + this.windowMs });
    }
  }
}
