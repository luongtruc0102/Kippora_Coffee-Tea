import { IsISO8601, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateStaffAttendanceDto {
  @IsISO8601({}, { message: 'Giờ vào ca không hợp lệ' })
  clockIn!: string;

  @IsISO8601({}, { message: 'Giờ ra ca không hợp lệ' })
  clockOut!: string;

  @IsString()
  @MinLength(3, { message: 'Lý do điều chỉnh phải có ít nhất 3 ký tự' })
  @MaxLength(255, { message: 'Lý do điều chỉnh không được quá 255 ký tự' })
  reason!: string;
}
