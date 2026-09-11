import { IsEnum, IsString, MinLength } from 'class-validator';
import { IngredientUnit } from '../../../generated/prisma/enums';

export class CreateIngredientDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEnum(IngredientUnit)
  unit!: IngredientUnit;
}
