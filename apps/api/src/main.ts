import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  // Khởi tạo toàn bộ ứng dụng NestJS từ AppModule
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Cho phép frontend Next.js gọi API từ localhost:3000
  app.enableCors({
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Tự động kiểm tra dữ liệu request dựa trên các DTO
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Loại bỏ các properties không được quy định trong DTO
      forbidNonWhitelisted: true, // Từ chối request nếu có properties không được quy định trong DTO
      transform: true, //chuyển request thành đúng kiểu DTO
    }),
  );

  // Cho frontend truy cập ảnh đã upload
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  // Chạy API ở PORT trong .env, nếu không có thì mặc định dùng port 4000
  await app.listen(process.env.PORT ?? 4000);
}

void bootstrap();
