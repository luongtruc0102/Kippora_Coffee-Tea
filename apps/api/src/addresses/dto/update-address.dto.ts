import {
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateAddressDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  label?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  receiverName?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  receiverPhone?: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  addressLine?: string;

  @IsOptional()
  @IsLatitude()
  latitude?: string;

  @IsOptional()
  @IsLongitude()
  longitude?: string;
}
