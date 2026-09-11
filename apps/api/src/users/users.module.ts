import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  providers: [UsersService],
  controllers: [UsersController],

  // Cho phép AuthModule sử dụng UsersService
  exports: [UsersService],
})
export class UsersModule {}
