import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewInventoryCountDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNote?: string;
}
