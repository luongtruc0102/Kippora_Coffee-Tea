import { IsBoolean } from 'class-validator';

export class UpdateBranchActiveDto {
  @IsBoolean()
  isActive!: boolean;
}
