import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { BANNER_TARGET_TYPES, BANNER_THEMES } from '../banner.constants';

export class UpdateBannerDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  eyebrow?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  subtitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  buttonLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @IsIn(BANNER_THEMES)
  theme?: string;

  @IsOptional()
  @IsString()
  @IsIn(BANNER_TARGET_TYPES)
  targetType?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  productId?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  voucherId?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  contentPageId?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(/^\/(?!\/)/, {
    message: 'Liên kết tùy chỉnh phải là đường dẫn nội bộ bắt đầu bằng /',
  })
  customUrl?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  branchId?: number | null;

  @IsOptional()
  @IsDateString()
  startsAt?: string | null;

  @IsOptional()
  @IsDateString()
  endsAt?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  sortOrder?: number;
}
