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

export class UpdateOrderReviewDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  overallRating?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;

  // Nếu gửi items, danh sách đánh giá món cũ sẽ được thay bằng danh sách mới.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({
    each: true,
  })
  @Type(() => CreateProductReviewDto)
  items?: CreateProductReviewDto[];
}
