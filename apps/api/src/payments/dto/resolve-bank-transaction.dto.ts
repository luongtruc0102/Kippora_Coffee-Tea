import { Type } from 'class-transformer';
import { IsInt, IsString, Length, Min } from 'class-validator';

export class MatchBankTransactionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  paymentId!: number;

  @IsString()
  @Length(5, 500)
  note!: string;
}

export class IgnoreBankTransactionDto {
  @IsString()
  @Length(5, 500)
  reason!: string;
}
