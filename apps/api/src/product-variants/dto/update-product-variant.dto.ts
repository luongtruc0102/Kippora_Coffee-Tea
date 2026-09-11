import {
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

// Kiểm tra dữ liệu khi cập nhật variant
export class UpdateProductVariantDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  size?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;
}
