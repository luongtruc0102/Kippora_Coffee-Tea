import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { RefundMethod } from '../../../generated/prisma/enums';

/// Dữ liệu hủy đơn của người quản lý. Phương thức hoàn tiền chỉ bắt buộc khi Payment đã PAID.
export class CancelManagedOrderDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(3, { message: 'Lý do hủy phải có ít nhất 3 ký tự' })
  @MaxLength(500, { message: 'Lý do hủy không được vượt quá 500 ký tự' })
  reason!: string;

  @IsOptional()
  @IsEnum(RefundMethod)
  refundMethod?: RefundMethod;
}
