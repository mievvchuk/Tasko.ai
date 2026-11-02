import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { setupApp } from './setup.js';
import { APP_CONFIG } from './config/config.module.js';
import type { AppConfig } from './config/config.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  setupApp(app);
  await app.listen(app.get<AppConfig>(APP_CONFIG).port);
}
await bootstrap();
