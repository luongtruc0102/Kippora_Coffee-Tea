import { IsBoolean } from 'class-validator';

export class UpdateContentPageStatusDto {
  @IsBoolean()
  isPublished!: boolean;
}
