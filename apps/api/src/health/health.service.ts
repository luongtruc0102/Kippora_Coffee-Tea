import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  // Inject PrismaService để có thể truy cập PostgreSQL
  constructor(private readonly prisma: PrismaService) {}

  async check() {
    // Query đơn giản để kiểm tra PostgreSQL có đang kết nối hay không
    await this.prisma.$queryRaw`SELECT 1`;

    // Trả trạng thái hệ thống cho GET /health
    return {
      status: 'ok',
      service: 'Kippora API',
      database: 'connected',
      timestamp: new Date().toISOString(),
    };
  }
}
