import { IsBoolean } from 'class-validator';

export class UpdateReviewVisibilityDto {
  @IsBoolean()
  isVisible!: boolean;
}
