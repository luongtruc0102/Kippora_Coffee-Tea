import { ArrayUnique, IsArray, IsInt, IsOptional, Min } from 'class-validator';

// Kiểm tra dữ liệu khi người dùng thêm món vào giỏ hàng
export class AddCartItemDto {
  // Sản phẩm gốc mà khách muốn thêm.
  @IsInt()
  productId!: number;

  // Size/biến thể phải thuộc đúng sản phẩm và đang hoạt động.
  @IsInt()
  variantId!: number;

  // Số lượng thêm mỗi lần phải là số nguyên dương.
  @IsInt()
  @Min(1)
  quantity!: number;

  // Danh sách topping là tùy chọn, chỉ nhận số nguyên và không trùng ID.
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  toppingIds?: number[];
}
