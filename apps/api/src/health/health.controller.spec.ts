import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import type { PrismaService } from '../prisma/prisma.service.js';

describe('health', () => {
  it('reports a successful database check', async () => {
    const prisma = { checkConnection: vi.fn().mockResolvedValue(undefined) };
    const controller = new HealthController(prisma as unknown as PrismaService);
    expect(await controller.check()).toEqual({ status: 'ok', database: 'ok' });
  });
  it('returns 503 without exposing database errors', async () => {
    const prisma = {
      checkConnection: vi
        .fn()
        .mockRejectedValue(new Error('private connection details')),
    };
    const controller = new HealthController(prisma as unknown as PrismaService);
    await expect(controller.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(controller.check()).rejects.toMatchObject({
      message: 'База даних недоступна або міграції не застосовано.',
    });
  });
});
