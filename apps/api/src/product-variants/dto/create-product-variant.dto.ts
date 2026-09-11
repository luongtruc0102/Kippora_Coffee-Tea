import { IsNumber, IsString, Min, MinLength } from 'class-validator';

// Kiểm tra dữ liệu khi tạo size mới cho sản phẩm
export class CreateProductVariantDto {
  @IsString()
  @MinLength(1)
  size!: string;

  // Giá theo từng size và không được nhỏ hơn 0
  @IsNumber()
  @Min(0)
  price!: number;
}
