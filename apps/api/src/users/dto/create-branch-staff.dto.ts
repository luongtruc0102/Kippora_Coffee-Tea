import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

// Trưởng chi nhánh không được tự truyền branchId; backend luôn lấy chi nhánh
// từ tài khoản đang đăng nhập để ngăn tạo nhân viên sang chi nhánh khác.
export class CreateBranchStaffDto {
  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @Matches(/^[0-9]{9,11}$/, {
    message: 'Số điện thoại không hợp lệ',
  })
  phone!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}
