import { Injectable, NotFoundException } from '@nestjs/common';
import type { Notification, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListOperationalAlertsDto } from './dto/list-operational-alerts.dto';

type AlertCategory =
  | 'INVENTORY'
  | 'PROCUREMENT'
  | 'FINANCE'
  | 'STAFFING'
  | 'PAYMENT'
  | 'ACCOUNTING'
  | 'SYSTEM';
type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

const OPERATIONAL_TYPES = [
  'LOW_STOCK',
  'INVENTORY_LOT_EXPIRING',
  'INVENTORY_LOT_EXPIRED',
  'INVENTORY_COUNT_SUBMITTED',
  'INVENTORY_COUNT_APPROVED',
  'INVENTORY_COUNT_REJECTED',
  'PURCHASE_ORDER_SUBMITTED',
  'PURCHASE_ORDER_APPROVED',
  'PURCHASE_ORDER_REJECTED',
  'PURCHASE_ORDER_ORDERED',
  'PURCHASE_ORDER_PARTIALLY_RECEIVED',
  'PURCHASE_ORDER_COMPLETED',
  'EXPENSE_SUBMITTED',
  'EXPENSE_APPROVED',
  'EXPENSE_REJECTED',
  'CASH_SESSION_PENDING',
  'CASH_SESSION_APPROVED',
  'CASH_SESSION_REOPENED',
  'MONTH_CLOSE_CLOSED',
  'MONTH_CLOSE_REOPENED',
  'LEAVE_REQUEST_CREATED',
  'LEAVE_REQUEST_SUPPLEMENTED',
  'LEAVE_REQUEST_CANCELLED',
  'SHIFT_COVERAGE_RESPONDED',
  'ATTENDANCE_PERIOD_APPROVED',
  'ATTENDANCE_PERIOD_RETURNED',
  'ATTENDANCE_PERIOD_REOPENED',
  'ATTENDANCE_CLOCK_OUT_OVERDUE',
  'ATTENDANCE_MISSING',
  'SHIFT_STARTING_SOON',
  'BANK_RECONCILIATION_AMOUNT_MISMATCH',
  'BANK_RECONCILIATION_UNMATCHED',
] as const;

function isOperationalType(type: string) {
  return (OPERATIONAL_TYPES as readonly string[]).includes(type);
}

function actionUrl(type: string, role: string) {
  const admin = role === 'ADMIN';
  if (type === 'LOW_STOCK')
    return admin ? '/admin/inventory' : '/staff/purchase-orders';
  if (type.startsWith('INVENTORY_LOT_'))
    return admin ? '/admin/inventory-lots' : '/staff/inventory-lots';
  if (type.startsWith('INVENTORY_COUNT_'))
    return admin ? '/admin/inventory-counts' : '/staff/inventory-counts';
  if (type.startsWith('PURCHASE_ORDER_'))
    return admin ? '/admin/purchase-orders' : '/staff/purchase-orders';
  if (type.startsWith('EXPENSE_'))
    return admin ? '/admin/expenses' : '/staff/expenses';
  if (type.startsWith('CASH_SESSION_'))
    return admin ? '/admin/cash-reconciliation' : '/staff/cash-reconciliation';
  if (type.startsWith('MONTH_CLOSE_'))
    return admin ? '/admin/month-close' : '/staff/month-close';
  if (type.startsWith('PAYROLL_'))
    return admin ? '/admin/payroll' : '/staff/payroll';
  if (type.startsWith('BANK_RECONCILIATION_'))
    return '/admin/bank-reconciliation';
  if (type.startsWith('LEAVE_REQUEST_') || type.startsWith('SHIFT_COVERAGE_'))
    return admin ? '/admin/schedules' : '/staff/employees';
  if (type.startsWith('ATTENDANCE_') || type === 'SHIFT_STARTING_SOON')
    return admin ? '/admin/schedules' : '/staff/schedules';
  if (type.startsWith('ORDER_') || type === 'PAYMENT_CONFIRMED')
    return admin ? '/admin/orders' : '/staff/orders';
  return admin ? '/admin/notifications' : '/staff/notifications';
}

function categoryOf(type: string): AlertCategory {
  if (
    type === 'LOW_STOCK' ||
    type.startsWith('INVENTORY_LOT_') ||
    type.startsWith('INVENTORY_COUNT_')
  )
    return 'INVENTORY';
  if (type.startsWith('PURCHASE_ORDER_')) return 'PROCUREMENT';
  if (type.startsWith('EXPENSE_') || type.startsWith('CASH_SESSION_'))
    return 'FINANCE';
  if (
    type.startsWith('ATTENDANCE_') ||
    type.startsWith('LEAVE_REQUEST_') ||
    type.startsWith('SHIFT_COVERAGE_') ||
    type === 'SHIFT_STARTING_SOON'
  )
    return 'STAFFING';
  if (
    type.startsWith('BANK_RECONCILIATION_') ||
    type.startsWith('ORDER_') ||
    type === 'PAYMENT_CONFIRMED'
  )
    return 'PAYMENT';
  if (type.startsWith('MONTH_CLOSE_') || type.startsWith('PAYROLL_'))
    return 'ACCOUNTING';
  return 'SYSTEM';
}

function severityOf(type: string): AlertSeverity {
  if (
    type === 'INVENTORY_LOT_EXPIRED' ||
    type === 'BANK_RECONCILIATION_AMOUNT_MISMATCH'
  )
    return 'CRITICAL';
  if (
    type === 'LOW_STOCK' ||
    type === 'ATTENDANCE_CLOCK_OUT_OVERDUE' ||
    type === 'ATTENDANCE_MISSING' ||
    type.endsWith('_SUBMITTED') ||
    type.endsWith('_PENDING') ||
    type.endsWith('_REOPENED') ||
    type === 'LEAVE_REQUEST_CREATED'
  )
    return 'WARNING';
  return 'INFO';
}

function requiresAction(type: string) {
  return (
    type === 'LOW_STOCK' ||
    type === 'INVENTORY_LOT_EXPIRED' ||
    type === 'INVENTORY_LOT_EXPIRING' ||
    type === 'ATTENDANCE_CLOCK_OUT_OVERDUE' ||
    type === 'ATTENDANCE_MISSING' ||
    type.startsWith('BANK_RECONCILIATION_') ||
    type.endsWith('_SUBMITTED') ||
    type.endsWith('_PENDING') ||
    type === 'LEAVE_REQUEST_CREATED'
  );
}

export function enrichOperationalNotification(
  notification: Notification,
  role: string,
) {
  return {
    ...notification,
    category: categoryOf(notification.type),
    severity: severityOf(notification.type),
    actionUrl: actionUrl(notification.type, role),
    requiresAction: requiresAction(notification.type),
  };
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  private async syncAttendanceAlerts(userId: number, role: string) {
    if (!['ADMIN', 'BRANCH_MANAGER'].includes(role)) return;
    let branchId: number | undefined;
    if (role === 'BRANCH_MANAGER') {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          managedBranch: { select: { id: true } },
          staffProfile: { select: { branchId: true } },
        },
      });
      branchId =
        user?.managedBranch?.id ?? user?.staffProfile?.branchId ?? undefined;
      if (!branchId) return;
    }

    const now = new Date();
    const lateThreshold = new Date(now.getTime() - 5 * 60_000);
    const soon = new Date(now.getTime() + 15 * 60_000);
    const branchWhere = branchId ? { branchId } : {};
    const [overdueAttendances, missingShifts, upcomingShifts] =
      await Promise.all([
        this.prisma.staffAttendance.findMany({
          where: {
            ...branchWhere,
            clockOut: null,
            scheduledShift: { is: { endAt: { lt: now } } },
          },
          select: {
            id: true,
            employee: {
              select: {
                email: true,
                profile: { select: { fullName: true } },
              },
            },
            branch: { select: { code: true } },
            scheduledShift: { select: { endAt: true } },
          },
          take: 100,
        }),
        this.prisma.staffShift.findMany({
          where: {
            ...branchWhere,
            startAt: { lte: lateThreshold },
            endAt: { gt: now },
            attendances: { none: {} },
          },
          select: {
            id: true,
            startAt: true,
            employee: {
              select: {
                email: true,
                profile: { select: { fullName: true } },
              },
            },
            branch: { select: { code: true } },
            leaveRequests: {
              where: { status: 'APPROVED' },
              select: { scope: true, requestedStartAt: true },
            },
          },
          take: 100,
        }),
        this.prisma.staffShift.findMany({
          where: {
            ...branchWhere,
            startAt: { gt: now, lte: soon },
            attendances: { none: {} },
          },
          select: {
            id: true,
            startAt: true,
            employee: {
              select: {
                email: true,
                profile: { select: { fullName: true } },
              },
            },
            branch: { select: { code: true } },
            leaveRequests: {
              where: { status: 'APPROVED' },
              select: { scope: true, requestedStartAt: true },
            },
          },
          take: 100,
        }),
      ]);

    const employeeName = (employee: {
      email: string;
      profile: { fullName: string | null } | null;
    }) => employee.profile?.fullName?.trim() || employee.email;
    const hasApprovedLeave = (shift: {
      leaveRequests: Array<{
        scope: string;
        requestedStartAt: Date | null;
      }>;
    }) =>
      shift.leaveRequests.some(
        (leave) =>
          leave.scope === 'FULL_SHIFT' ||
          (leave.scope === 'LATE_ARRIVAL' &&
            leave.requestedStartAt &&
            leave.requestedStartAt > now),
      );
    const time = (value: Date) =>
      value.toLocaleTimeString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
      });
    const alerts = [
      ...overdueAttendances
        .filter((item) => item.scheduledShift)
        .map((item) => ({
          userId,
          dedupeKey: `ATTENDANCE_CLOCK_OUT_OVERDUE:${item.id}`,
          type: 'ATTENDANCE_CLOCK_OUT_OVERDUE',
          title: 'Nhân viên chưa kết thúc ca',
          message: `${item.branch.code} · ${employeeName(item.employee)} vẫn đang mở ca sau ${time(item.scheduledShift!.endAt)}.`,
        })),
      ...missingShifts
        .filter((shift) => !hasApprovedLeave(shift))
        .map((shift) => ({
          userId,
          dedupeKey: `ATTENDANCE_MISSING:${shift.id}`,
          type: 'ATTENDANCE_MISSING',
          title: 'Nhân viên chưa vào ca',
          message: `${shift.branch.code} · ${employeeName(shift.employee)} chưa điểm danh ca ${time(shift.startAt)}.`,
        })),
      ...upcomingShifts
        .filter((shift) => !hasApprovedLeave(shift))
        .map((shift) => ({
          userId,
          dedupeKey: `SHIFT_STARTING_SOON:${shift.id}`,
          type: 'SHIFT_STARTING_SOON',
          title: 'Ca làm sắp bắt đầu',
          message: `${shift.branch.code} · ${employeeName(shift.employee)} có ca lúc ${time(shift.startAt)}.`,
        })),
    ];
    if (alerts.length) {
      await this.prisma.notification.createMany({
        data: alerts,
        skipDuplicates: true,
      });
    }
  }

  // Trả tối đa 30 thông báo gần nhất kèm tổng số chưa đọc cho badge header.
  async findMine(userId: number, role?: string) {
    const isManager = Boolean(
      role && ['ADMIN', 'BRANCH_MANAGER'].includes(role),
    );
    if (isManager && role) await this.syncAttendanceAlerts(userId, role);
    const [items, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      this.prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ]);

    return {
      items:
        isManager && role
          ? items.map((item) =>
              isOperationalType(item.type)
                ? enrichOperationalNotification(item, role)
                : item,
            )
          : items,
      unreadCount,
    };
  }

  async findOperational(
    userId: number,
    role: string,
    query: ListOperationalAlertsDto,
  ) {
    await this.syncAttendanceAlerts(userId, role);
    const keyword = query.q?.trim().toLocaleLowerCase('vi-VN');
    const filteredTypes = OPERATIONAL_TYPES.filter((type) => {
      if (
        query.category &&
        query.category !== 'ALL' &&
        categoryOf(type) !== query.category
      )
        return false;
      if (
        query.severity &&
        query.severity !== 'ALL' &&
        severityOf(type) !== query.severity
      )
        return false;
      return true;
    });
    const page = query.page || 1;
    const limit = query.limit || 20;
    const baseWhere: Prisma.NotificationWhereInput = {
      userId,
      type: { in: [...OPERATIONAL_TYPES] },
    };
    const where: Prisma.NotificationWhereInput = {
      ...baseWhere,
      type: { in: [...filteredTypes] },
      ...(query.readStatus === 'READ'
        ? { isRead: true }
        : query.readStatus === 'UNREAD'
          ? { isRead: false }
          : {}),
      ...(keyword
        ? {
            OR: [
              { title: { contains: keyword, mode: 'insensitive' } },
              { message: { contains: keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const criticalTypes = OPERATIONAL_TYPES.filter(
      (type) => severityOf(type) === 'CRITICAL',
    );
    const actionTypes = OPERATIONAL_TYPES.filter(requiresAction);
    const [
      notifications,
      total,
      summaryTotal,
      summaryUnread,
      summaryCritical,
      summaryRequiresAction,
    ] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: baseWhere }),
      this.prisma.notification.count({
        where: { ...baseWhere, isRead: false },
      }),
      this.prisma.notification.count({
        where: {
          userId,
          isRead: false,
          type: { in: [...criticalTypes] },
        },
      }),
      this.prisma.notification.count({
        where: {
          userId,
          isRead: false,
          type: { in: [...actionTypes] },
        },
      }),
    ]);
    return {
      items: notifications.map((item) =>
        enrichOperationalNotification(item, role),
      ),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      summary: {
        total: summaryTotal,
        unread: summaryUnread,
        critical: summaryCritical,
        requiresAction: summaryRequiresAction,
      },
    };
  }

  async markAllOperationalRead(userId: number) {
    const readAt = new Date();
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
        type: { in: [...OPERATIONAL_TYPES] },
      },
      data: { isRead: true, readAt },
    });
    return { updatedCount: result.count, readAt };
  }

  // Chỉ chủ sở hữu mới được đánh dấu thông báo của mình là đã đọc.
  async markRead(userId: number, notificationId: number) {
    const result = await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true, readAt: new Date() },
    });

    if (result.count !== 1) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }

    return this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
  }

  async markAllRead(userId: number) {
    const readAt = new Date();
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt },
    });

    return { updatedCount: result.count, readAt };
  }
}
