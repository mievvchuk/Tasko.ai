import {
  ArgumentsHost,
  Catch,
  HttpException,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import { hasDatabaseCode } from '../prisma/database-error.js';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    if (response.headersSent) return;
    if (error instanceof HttpException) {
      const body = error.getResponse();
      response
        .status(error.getStatus())
        .json(
          typeof body === 'string'
            ? { statusCode: error.getStatus(), message: body }
            : body,
        );
      return;
    }
    if (hasDatabaseCode(error, '23505')) {
      response
        .status(409)
        .json({ statusCode: 409, message: 'Такий запис уже існує.' });
      return;
    }
    const unavailable = [
      'ECONNREFUSED',
      'ETIMEDOUT',
      'EACCES',
      'ECONNRESET',
      '57P01',
      '53300',
    ].some((code) => hasDatabaseCode(error, code));
    this.logger.error(
      unavailable
        ? 'З’єднання з PostgreSQL недоступне.'
        : 'Необроблена внутрішня помилка API.',
    );
    response.status(unavailable ? 503 : 500).json({
      statusCode: unavailable ? 503 : 500,
      message: unavailable
        ? 'База даних недоступна.'
        : 'Внутрішня помилка сервера.',
    });
  }
}
