import type { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type AuditLogInput = {
  actorId?: number | null;
  branchId?: number | null;
  module:
    | 'STAFF_SCHEDULE'
    | 'ATTENDANCE'
    | 'LEAVE'
    | 'PAYROLL'
    | 'INVENTORY'
    | 'EXPENSE'
    | 'CASH_RECONCILIATION'
    | 'ORDER'
    | 'PAYMENT'
    | 'PRICING';
  action: string;
  entityType: string;
  entityId?: string | number | null;
  description: string;
  beforeData?: unknown;
  afterData?: unknown;
  metadata?: unknown;
};

function snapshot(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

// Hàm dùng chung chỉ tạo bản ghi. Cố ý không cung cấp thao tác sửa hoặc xóa.
// Kiểm tra delegate giúp các unit test cũ dùng Prisma mock tối giản vẫn hoạt động.
export async function writeAuditLog(
  prisma: PrismaService,
  input: AuditLogInput,
) {
  const auditLog = (
    prisma as PrismaService & { auditLog?: PrismaService['auditLog'] }
  ).auditLog;
  if (!auditLog) return;
  await auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      branchId: input.branchId ?? null,
      module: input.module,
      action: input.action,
      entityType: input.entityType,
      entityId:
        input.entityId === undefined || input.entityId === null
          ? null
          : String(input.entityId),
      description: input.description,
      beforeData: snapshot(input.beforeData),
      afterData: snapshot(input.afterData),
      metadata: snapshot(input.metadata),
    },
  });
}
