import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { getAuthSessionTtlSeconds } from './auth-session.config';
import { PasswordResetMailService } from './password-reset-mail.service';

@Module({
  imports: [
    UsersModule,

    // Cấu hình JWT bằng JWT_SECRET trong file .env
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: getAuthSessionTtlSeconds(
            configService.get<string>('AUTH_SESSION_TTL_HOURS'),
          ),
        },
      }),
    }),
  ],

  providers: [AuthService, PasswordResetMailService],

  controllers: [AuthController],

  // Cho phép Global JwtAuthGuard sử dụng JwtService
  exports: [JwtModule],
})
export class AuthModule {}
