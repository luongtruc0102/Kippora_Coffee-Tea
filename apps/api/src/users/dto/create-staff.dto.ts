import {
  IsEmail,
  IsString,
  Matches,
  MinLength,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';

export class CreateStaffDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  branchId?: number;

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
