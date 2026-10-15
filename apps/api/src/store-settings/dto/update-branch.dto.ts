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

function emptyToNull(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  return trimmed === '' ? null : trimmed;
}

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class UpdateBranchDto {
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @Transform(({ value }) => emptyToNull(value))
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string | null;

  @Transform(({ value }) => emptyToNull(value))
  @IsOptional()
  @Matches(/^[0-9]{9,11}$/, {
    message: 'Số điện thoại không hợp lệ',
  })
  phone?: string | null;

  @Transform(({ value }) =>
    value === '' || value === null || value === undefined
      ? value === undefined
        ? undefined
        : null
      : Number(value),
  )
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 }, { message: 'Vĩ độ không hợp lệ' })
  @Min(-90)
  @Max(90)
  latitude?: number | null;

  @Transform(({ value }) =>
    value === '' || value === null || value === undefined
      ? value === undefined
        ? undefined
        : null
      : Number(value),
  )
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 }, { message: 'Kinh độ không hợp lệ' })
  @Min(-180)
  @Max(180)
  longitude?: number | null;

  @Transform(({ value }) => emptyToNull(value))
  @IsOptional()
  @IsDateString({}, { message: 'Ngày mở chi nhánh không hợp lệ' })
  openedAt?: string | null;
}
