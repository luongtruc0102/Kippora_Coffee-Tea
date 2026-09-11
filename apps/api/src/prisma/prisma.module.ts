import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// Cho phép PrismaService được sử dụng ở toàn bộ backend mà không cần import PrismaModule lại
@Global()
@Module({
  providers: [PrismaService],

  // Export PrismaService để các module/service khác có thể inject và truy cập database
  exports: [PrismaService],
})
export class PrismaModule {}
