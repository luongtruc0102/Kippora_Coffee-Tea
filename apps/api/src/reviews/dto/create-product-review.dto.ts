import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProductReviewDto {
  // ID dòng món thuộc đơn hàng, không nhận productId trực tiếp
  // để backend tự xác minh khách thực sự đã mua món.
  @IsInt()
  @Min(1)
  orderItemId!: number;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
