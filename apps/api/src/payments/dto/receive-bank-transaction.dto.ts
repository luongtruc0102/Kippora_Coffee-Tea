import {
  IsDateString,
  IsNumber,
  IsString,
  Length,
  Matches,
  Min,
} from 'class-validator';

export class ReceiveBankTransactionDto {
  @IsString()
  @Matches(/^\d{6}$/)
  bankBin!: string;

  @IsString()
  @Length(6, 30)
  accountNumber!: string;

  @IsString()
  @Length(3, 100)
  providerReference!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  amount!: number;

  @IsString()
  @Length(1, 500)
  description!: string;

  @IsDateString()
  occurredAt!: string;
}
