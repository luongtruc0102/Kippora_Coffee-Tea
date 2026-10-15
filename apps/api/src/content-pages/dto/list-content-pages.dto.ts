import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { CONTENT_PAGE_CATEGORIES } from '../content-page.constants';

export class ListContentPagesDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsString()
  @IsIn(CONTENT_PAGE_CATEGORIES)
  category?: string;

  @IsOptional()
  @IsString()
  @IsIn(['ALL', 'PUBLISHED', 'DRAFT'])
  status?: string;
}
