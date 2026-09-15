import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/// Ngăn chứng từ mới hoặc chỉnh sửa bị ghi ngược vào một tháng đã chốt.
/// Delegate tùy chọn giúp các unit test cũ với Prisma mock tối giản tiếp tục hoạt động.
export async function assertAccountingMonthOpen(
  prisma: PrismaService,
  branchId: number,
  occurredAt: Date,
  action: string,
) {
  const monthlyClosePeriod = (
    prisma as PrismaService & {
      monthlyClosePeriod?: PrismaService['monthlyClosePeriod'];
    }
  ).monthlyClosePeriod;
  if (!monthlyClosePeriod) return;
  const month = occurredAt.toISOString().slice(0, 7);
  const period = await monthlyClosePeriod.findUnique({
    where: {
      branchId_periodStart: {
        branchId,
        periodStart: new Date(`${month}-01T00:00:00.000Z`),
      },
    },
    select: { status: true },
  });
  if (period?.status === 'CLOSED') {
    throw new BadRequestException(
      `Tháng ${month} đã chốt sổ. Hãy mở lại kỳ kế toán trước khi ${action}.`,
    );
  }
}
