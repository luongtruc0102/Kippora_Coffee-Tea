import { SupportConversationStatus } from '../../../generated/prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateSupportStatusDto {
  @IsEnum(SupportConversationStatus)
  status!: SupportConversationStatus;
}
