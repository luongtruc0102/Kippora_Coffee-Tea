import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

// Quy định và kiểm tra dữ liệu client được phép gửi khi đăng ký
export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsString()
  fullName?: string;
}
