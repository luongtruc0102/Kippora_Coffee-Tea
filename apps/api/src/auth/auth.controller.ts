import { Body, Controller, Get, Patch, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Public } from '../common/decorators/public.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

// Request sau khi JwtAuthGuard xác thực sẽ có thông tin user
interface AuthenticatedRequest extends Request {
  user: {
    sub: number;
    email: string;
    role: string;
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Đăng ký tài khoản - không yêu cầu đăng nhập
  @Public()
  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  // Đăng nhập - không yêu cầu Access Token
  @Public()
  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  // GET /auth/me - lấy thông tin người dùng từ Access Token
  @Get('me')
  getProfile(@Req() request: AuthenticatedRequest) {
    return this.authService.getProfile(request.user.sub);
  }

  // PATCH /auth/me - user cập nhật hồ sơ của chính mình.
  @Patch('me')
  updateProfile(
    @Req()
    request: AuthenticatedRequest,

    @Body()
    dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(request.user.sub, dto);
  }

  // PATCH /auth/change-password
  // Chỉ tài khoản đã đăng nhập mới được đổi mật khẩu của chính mình.
  @Patch('change-password')
  changePassword(
    @Req()
    request: AuthenticatedRequest,

    @Body()
    dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(request.user.sub, dto);
  }
}
