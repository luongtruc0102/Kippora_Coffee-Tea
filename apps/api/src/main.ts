import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { configureApplication } from './app.setup';

async function bootstrap() {
  // Khởi tạo toàn bộ ứng dụng NestJS từ AppModule
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Dùng chung với E2E để test đúng cấu hình bảo mật ngoài production.
  configureApplication(app);

  // Chạy API ở PORT trong .env, nếu không có thì mặc định dùng port 4000
  await app.listen(process.env.PORT ?? 4000);
}

void bootstrap();
