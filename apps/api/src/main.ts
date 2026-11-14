import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { setupApp } from './setup.js';
import { APP_CONFIG } from './config/config.module.js';
import type { AppConfig } from './config/config.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Render ставить перед API один проксі: справжній IP — з X-Forwarded-For (ліміти спроб, список сеансів)
  app.set('trust proxy', 1);
  setupApp(app);
  await app.listen(app.get<AppConfig>(APP_CONFIG).port);
}
await bootstrap();
