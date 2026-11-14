import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { setupApp } from './setup.js';
import { APP_CONFIG } from './config/config.module.js';
import type { AppConfig } from './config/config.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Скільки проксі стоїть перед API (на Render — 1): тоді IP береться з X-Forwarded-For.
  // Без змінної заголовку не довіряємо, інакше клієнт підробить собі IP і обійде ліміти.
  const proxyHops = Number(process.env.TRUST_PROXY ?? 0);
  if (Number.isInteger(proxyHops) && proxyHops > 0)
    app.set('trust proxy', proxyHops);
  setupApp(app);
  await app.listen(app.get<AppConfig>(APP_CONFIG).port);
}
await bootstrap();
