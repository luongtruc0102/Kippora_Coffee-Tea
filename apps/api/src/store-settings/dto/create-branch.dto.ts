import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

function emptyToUndefined(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  return trimmed === '' ? undefined : trimmed;
}

function normalizeBranchCode(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

export class CreateBranchDto {
  @Transform(({ value }) => normalizeBranchCode(value))
  @IsString()
  @Matches(/^[A-Z0-9_-]{2,20}$/, {
    message:
      'Mã chi nhánh chỉ gồm 2-20 ký tự chữ, số, gạch ngang hoặc gạch dưới',
  })
  code!: string;

  @Transform(({ value }) => emptyToUndefined(value))
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @Transform(({ value }) => emptyToUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @Transform(({ value }) => emptyToUndefined(value))
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{9,11}$/, {
    message: 'Số điện thoại không hợp lệ',
  })
  phone?: string;

  @Transform(({ value }) =>
    value === '' || value === null || value === undefined
      ? undefined
      : Number(value),
  )
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 }, { message: 'Vĩ độ không hợp lệ' })
  @Min(-90)
  @Max(90)
  latitude?: number;

  @Transform(({ value }) =>
    value === '' || value === null || value === undefined
      ? undefined
      : Number(value),
  )
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 }, { message: 'Kinh độ không hợp lệ' })
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày mở chi nhánh không hợp lệ' })
  openedAt?: string;
}
