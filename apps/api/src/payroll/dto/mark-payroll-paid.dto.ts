import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { StaffPayrollPaymentMethod } from '../../../generated/prisma/enums';

export class MarkPayrollPaidDto {
  @IsIn(['CASH', 'BANK_TRANSFER'])
  method!: StaffPayrollPaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;
}
