import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsUrl(
    {
      require_protocol: true,

      // Cho phép localhost khi phát triển.
      require_tld: false,
    },
    {
      message: 'avatarUrl phải là đường dẫn ảnh hợp lệ',
    },
  )
  @MaxLength(500)
  avatarUrl?: string;
}
