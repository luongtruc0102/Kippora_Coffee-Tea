import {
  IsBoolean,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpsertBankAccountDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'BIN ngân hàng phải gồm đúng 6 chữ số' })
  bankBin!: string;

  @IsString()
  @Length(2, 20)
  @Matches(/^[A-Za-z0-9]+$/, { message: 'Mã ngân hàng không hợp lệ' })
  bankCode!: string;

  @IsString()
  @Length(2, 120)
  bankName!: string;

  @IsString()
  @Length(6, 30)
  @Matches(/^[A-Za-z0-9]+$/, { message: 'Số tài khoản không hợp lệ' })
  accountNumber!: string;

  @IsString()
  @Length(3, 100)
  @MaxLength(100)
  accountName!: string;

  @IsBoolean()
  isActive!: boolean;
}
