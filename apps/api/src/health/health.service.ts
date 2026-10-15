import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  // Inject PrismaService để có thể truy cập PostgreSQL
  constructor(private readonly prisma: PrismaService) {}

  live() {
    return {
      status: 'ok',
      service: 'Kippora API',
      timestamp: new Date().toISOString(),
    };
  }

  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        status: 'unavailable',
        service: 'Kippora API',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      });
    }

    return {
      ...this.live(),
      database: 'connected',
    };
  }

  // Giữ endpoint cũ tương thích với hệ thống giám sát đang dùng.
  check() {
    return this.ready();
  }
}
