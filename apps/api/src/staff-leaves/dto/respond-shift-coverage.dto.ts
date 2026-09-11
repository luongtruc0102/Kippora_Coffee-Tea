import { IsIn } from 'class-validator';

export type ShiftCoverageResponseAction = 'ACCEPTED' | 'DECLINED';

export class RespondShiftCoverageDto {
  @IsIn(['ACCEPTED', 'DECLINED'])
  action!: ShiftCoverageResponseAction;
}
