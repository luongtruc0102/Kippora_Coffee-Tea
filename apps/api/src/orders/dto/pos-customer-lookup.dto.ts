import { IsString, MaxLength, MinLength } from 'class-validator';

export class PosCustomerLookupDto {
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  phone!: string;
}
