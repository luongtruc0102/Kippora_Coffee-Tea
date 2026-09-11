import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // Lấy chuỗi kết nối PostgreSQL từ file .env
    const connectionString = process.env.DATABASE_URL;

    // Dừng ứng dụng nếu chưa cấu hình DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL is not defined');
    }

    // Tạo adapter để Prisma kết nối với PostgreSQL
    const adapter = new PrismaPg({
      connectionString,
    });

    super({ adapter });
  }

  // Tự động kết nối database khi NestJS khởi động
  async onModuleInit() {
    await this.$connect();
  }

  // Tự động ngắt kết nối database khi NestJS tắt
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
