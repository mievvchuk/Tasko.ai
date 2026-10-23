import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { APP_CONFIG } from './config/config.module.js';
import type { AppConfig } from './config/config.js';
import { ApiExceptionFilter } from './common/api-exception.filter.js';

export function setupApp(app: INestApplication) {
  const config = app.get<AppConfig>(APP_CONFIG);
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors({ origin: config.webOrigin, credentials: false });
  app.enableShutdownHooks();
  const swagger = new DocumentBuilder()
    .setTitle('AIFreelanceSystem API')
    .setDescription('Керування фриланс-проєктами')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));
}
