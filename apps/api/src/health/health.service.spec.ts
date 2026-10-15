import { ServiceUnavailableException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  it('liveness không truy cập database', () => {
    const queryRaw = jest.fn();
    const service = new HealthService({
      $queryRaw: queryRaw,
    } as unknown as PrismaService);

    expect(service.live()).toMatchObject({
      status: 'ok',
      service: 'Kippora API',
    });
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('readiness báo database đã kết nối', async () => {
    const service = new HealthService({
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    } as unknown as PrismaService);

    await expect(service.ready()).resolves.toMatchObject({
      status: 'ok',
      database: 'connected',
    });
  });

  it('readiness trả 503 khi database không sẵn sàng', async () => {
    const service = new HealthService({
      $queryRaw: jest.fn().mockRejectedValue(new Error('database offline')),
    } as unknown as PrismaService);

    await expect(service.ready()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
