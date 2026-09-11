import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { InventoryLotStatus } from '../../../generated/prisma/enums';

export enum InventoryLotExpiryFilter {
  ALL = 'ALL',
  EXPIRING = 'EXPIRING',
  EXPIRED = 'EXPIRED',
  NO_EXPIRY = 'NO_EXPIRY',
}

export class ListInventoryLotsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branchId?: number;

  @IsOptional()
  @IsEnum(InventoryLotStatus)
  status?: InventoryLotStatus;

  @IsOptional()
  @IsEnum(InventoryLotExpiryFilter)
  expiry?: InventoryLotExpiryFilter;

  @IsOptional()
  @IsString()
  q?: string;
}
