import {
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateAddressDto {
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  label!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  receiverName!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(20)
  receiverPhone!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  addressLine!: string;

  // Dùng string để đồng bộ với CheckoutDto và tránh sai số tọa độ.
  @IsLatitude()
  latitude!: string;

  @IsLongitude()
  longitude!: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
