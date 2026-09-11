import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Dữ liệu user gửi khi đổi mật khẩu.
 * Không nhận userId từ client để tránh đổi mật khẩu tài khoản khác.
 */
export class ChangePasswordDto {
  @IsString()
  @MinLength(6)
  @MaxLength(100)
  currentPassword!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(100)
  newPassword!: string;
}
