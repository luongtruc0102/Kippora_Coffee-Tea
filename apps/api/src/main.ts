import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import helmet from 'helmet';

async function bootstrap() {
  // Khởi tạo toàn bộ ứng dụng NestJS từ AppModule
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Các header bảo vệ phổ biến; cho phép tài nguyên ảnh được hiển thị ở frontend khác cổng.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Danh sách frontend được phép gọi API, cấu hình bằng CORS_ORIGINS khi triển khai.
  const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
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

  // Chỉ ảnh công khai mới được phục vụ trực tiếp. Minh chứng nghỉ phép đi qua
  // endpoint có Access Token và kiểm tra quyền trong UploadsController.
  for (const publicDirectory of [
    'products',
    'toppings',
    'avatars',
    'banners',
  ]) {
    app.useStaticAssets(join(process.cwd(), 'uploads', publicDirectory), {
      prefix: `/uploads/${publicDirectory}/`,
    });
  }

  // Chạy API ở PORT trong .env, nếu không có thì mặc định dùng port 4000
  await app.listen(process.env.PORT ?? 4000);
}

void bootstrap();
