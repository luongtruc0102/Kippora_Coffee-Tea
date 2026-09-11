import { IsEmail, IsString, MinLength } from 'class-validator';

// Quy định và kiểm tra dữ liệu client gửi khi đăng nhập
export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}
