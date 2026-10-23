import {
  Controller,
  Get,
  Inject,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    try {
      await this.prisma.checkConnection();
      return { status: 'ok', database: 'ok' };
    } catch {
      this.logger.error('Перевірка PostgreSQL не пройшла.');
      throw new ServiceUnavailableException(
        'База даних недоступна або міграції не застосовано.',
      );
    }
  }
}
