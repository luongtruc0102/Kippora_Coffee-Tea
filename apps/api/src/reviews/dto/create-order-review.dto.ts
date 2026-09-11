import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { Type } from 'class-transformer';

import { CreateProductReviewDto } from './create-product-review.dto';

export class CreateOrderReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  overallRating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;

  // Khách có thể chỉ đánh giá tổng thể hoặc đánh giá thêm từng món.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({
    each: true,
  })
  @Type(() => CreateProductReviewDto)
  items?: CreateProductReviewDto[];
}
