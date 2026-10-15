import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  SupportConversationStatus,
  type Prisma,
} from '../../generated/prisma/client';
import { writeAuditLog } from '../common/audit-logs/audit-log.util';
import { personProfileSelect } from '../common/user-profiles/user-profiles.util';
import { PrismaService } from '../prisma/prisma.service';
import { ListSupportConversationsDto } from './dto/list-support-conversations.dto';
import { SupportMetricsQueryDto } from './dto/support-metrics-query.dto';
import { SupportRouteDto } from './dto/support-route.dto';

type SupportRouteClient = Pick<
  Prisma.TransactionClient,
  'order' | 'storeBranch'
>;

const customerSelect = {
  id: true,
  email: true,
  ...personProfileSelect,
} satisfies Prisma.UserSelect;

const senderSelect = {
  id: true,
  email: true,
  role: { select: { name: true } },
  ...personProfileSelect,
} satisfies Prisma.UserSelect;

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeContent(content: string) {
    const normalized = content.trim();
    if (!normalized) {
      throw new BadRequestException('Tin nhắn không được để trống');
    }
    return normalized;
  }

  private mapPerson<
    T extends {
      profile: {
        fullName: string | null;
        phone: string | null;
        avatarUrl: string | null;
      } | null;
    },
  >(person: T) {
    const { profile, ...account } = person;
    return {
      ...account,
      fullName: profile?.fullName ?? null,
      phone: profile?.phone ?? null,
      avatarUrl: profile?.avatarUrl ?? null,
    };
  }

  private async resolveCustomerRoute(
    client: SupportRouteClient,
    customerId: number,
    route: SupportRouteDto = {},
  ) {
    if (route.orderId) {
      const order = await client.order.findFirst({
        where: { id: route.orderId, userId: customerId },
        select: { id: true, branchId: true },
      });
      if (!order) {
        throw new NotFoundException('Không tìm thấy đơn hàng của khách');
      }
      return { branchId: order.branchId, relatedOrderId: order.id };
    }

    if (route.branchId) {
      const branch = await client.storeBranch.findFirst({
        where: { id: route.branchId, isActive: true },
        select: { id: true },
      });
      if (!branch) {
        throw new BadRequestException('Chi nhánh hỗ trợ không còn hoạt động');
      }
      const latestOrder = await client.order.findFirst({
        where: { userId: customerId, branchId: branch.id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { id: true },
      });
      return {
        branchId: branch.id,
        relatedOrderId: latestOrder?.id ?? null,
      };
    }

    const latestOrder = await client.order.findFirst({
      where: { userId: customerId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true, branchId: true },
    });
    if (latestOrder) {
      return {
        branchId: latestOrder.branchId,
        relatedOrderId: latestOrder.id,
      };
    }

    const fallbackBranch = await client.storeBranch.findFirst({
      where: { isActive: true },
      orderBy: { id: 'asc' },
      select: { id: true },
    });
    if (!fallbackBranch) {
      throw new BadRequestException('Chưa có chi nhánh hoạt động để hỗ trợ');
    }
    return { branchId: fallbackBranch.id, relatedOrderId: null };
  }

  private async resolveManagedBranchId(managerId: number) {
    const manager = await this.prisma.user.findUnique({
      where: { id: managerId },
      select: {
        managedBranch: { select: { id: true, isActive: true } },
        staffProfile: { select: { branchId: true } },
      },
    });
    if (
      !manager?.managedBranch ||
      manager.staffProfile?.branchId !== manager.managedBranch.id
    ) {
      throw new ForbiddenException(
        'Tài khoản chưa được phân công quản lý chi nhánh hợp lệ',
      );
    }
    return manager.managedBranch.id;
  }

  private async findConversation(id: number, branchId?: number) {
    const conversation = await this.prisma.supportConversation.findFirst({
      where: { id, ...(branchId ? { branchId } : {}) },
      select: {
        id: true,
        status: true,
        customerId: true,
        branchId: true,
        relatedOrderId: true,
        firstResponseAt: true,
        resolvedAt: true,
        reopenedCount: true,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Không tìm thấy hội thoại hỗ trợ');
    }

    return conversation;
  }

  private async loadConversation(id: number) {
    const conversation = await this.prisma.supportConversation.findUnique({
      where: { id },
      include: {
        customer: { select: customerSelect },
        branch: {
          select: { id: true, code: true, name: true, address: true },
        },
        relatedOrder: {
          select: { id: true, status: true, branchId: true, createdAt: true },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { sender: { select: senderSelect } },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Không tìm thấy hội thoại hỗ trợ');
    }

    return {
      ...conversation,
      customer: this.mapPerson(conversation.customer),
      messages: conversation.messages.map((message) => ({
        ...message,
        sender: this.mapPerson(message.sender),
      })),
    };
  }

  async getCustomerConversation(
    customerId: number,
    route: SupportRouteDto = {},
  ) {
    const target = await this.resolveCustomerRoute(
      this.prisma,
      customerId,
      route,
    );
    const conversation = await this.prisma.supportConversation.findUnique({
      where: {
        customerId_branchId: {
          customerId,
          branchId: target.branchId,
        },
      },
      select: { id: true },
    });

    if (!conversation) return null;

    await this.prisma.supportMessage.updateMany({
      where: {
        conversationId: conversation.id,
        senderType: { in: ['ADMIN', 'STAFF'] },
        readByCustomerAt: null,
      },
      data: { readByCustomerAt: new Date() },
    });

    return this.loadConversation(conversation.id);
  }

  async getCustomerUnreadCount(customerId: number) {
    const unreadCount = await this.prisma.supportMessage.count({
      where: {
        conversation: { customerId },
        senderType: { in: ['ADMIN', 'STAFF'] },
        readByCustomerAt: null,
      },
    });

    return { unreadCount };
  }

  async sendCustomerMessage(
    customerId: number,
    rawContent: string,
    route: SupportRouteDto = {},
  ) {
    const content = this.normalizeContent(rawContent);
    const now = new Date();

    const conversation = await this.prisma.$transaction(async (tx) => {
      const target = await this.resolveCustomerRoute(tx, customerId, route);
      const existing = await tx.supportConversation.findUnique({
        where: {
          customerId_branchId: {
            customerId,
            branchId: target.branchId,
          },
        },
        select: { status: true },
      });
      const current = await tx.supportConversation.upsert({
        where: {
          customerId_branchId: {
            customerId,
            branchId: target.branchId,
          },
        },
        create: {
          customerId,
          branchId: target.branchId,
          relatedOrderId: target.relatedOrderId,
          status: SupportConversationStatus.OPEN,
          lastMessageAt: now,
        },
        update: {
          status: SupportConversationStatus.OPEN,
          lastMessageAt: now,
          resolvedAt: null,
          ...(existing?.status === SupportConversationStatus.RESOLVED
            ? { reopenedCount: { increment: 1 } }
            : {}),
          ...(target.relatedOrderId
            ? { relatedOrderId: target.relatedOrderId }
            : {}),
        },
        select: { id: true, branchId: true },
      });

      await tx.supportMessage.create({
        data: {
          conversationId: current.id,
          senderId: customerId,
          senderType: 'CUSTOMER',
          content,
          readByCustomerAt: now,
        },
      });

      const branchManagers = await tx.user.findMany({
        where: {
          isActive: true,
          role: { name: 'BRANCH_MANAGER' },
          managedBranch: { id: current.branchId },
        },
        select: { id: true },
      });
      if (branchManagers.length) {
        const preview =
          content.length > 120 ? `${content.slice(0, 117)}...` : content;
        await tx.notification.createMany({
          data: branchManagers.map((manager) => ({
            userId: manager.id,
            type: 'SUPPORT_NEW_MESSAGE',
            title: 'Khách hàng cần hỗ trợ tại chi nhánh',
            message: preview,
          })),
        });
      }

      return current;
    });

    return this.loadConversation(conversation.id);
  }

  async listForManagement(
    viewerId: number,
    viewerRole: string,
    query: ListSupportConversationsDto,
  ) {
    const scopedBranchId =
      viewerRole === 'ADMIN'
        ? query.branchId
        : await this.resolveManagedBranchId(viewerId);
    const q = query.q?.trim();
    const scopeWhere: Prisma.SupportConversationWhereInput = scopedBranchId
      ? { branchId: scopedBranchId }
      : {};
    const where: Prisma.SupportConversationWhereInput = {
      ...scopeWhere,
      ...(query.status ? { status: query.status } : {}),
      ...(q
        ? {
            customer: {
              OR: [
                { email: { contains: q, mode: 'insensitive' } },
                {
                  profile: {
                    is: { fullName: { contains: q, mode: 'insensitive' } },
                  },
                },
                { profile: { is: { phone: { contains: q } } } },
              ],
            },
          }
        : {}),
    };

    const [conversations, open, waiting, resolved, unread] = await Promise.all([
      this.prisma.supportConversation.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        include: {
          customer: { select: customerSelect },
          branch: {
            select: { id: true, code: true, name: true, address: true },
          },
          relatedOrder: {
            select: { id: true, status: true, branchId: true, createdAt: true },
          },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          _count: {
            select: {
              messages: {
                where: { senderType: 'CUSTOMER', readByAdminAt: null },
              },
            },
          },
        },
      }),
      this.prisma.supportConversation.count({
        where: { ...scopeWhere, status: SupportConversationStatus.OPEN },
      }),
      this.prisma.supportConversation.count({
        where: {
          ...scopeWhere,
          status: SupportConversationStatus.WAITING_CUSTOMER,
        },
      }),
      this.prisma.supportConversation.count({
        where: { ...scopeWhere, status: SupportConversationStatus.RESOLVED },
      }),
      this.prisma.supportMessage.count({
        where: {
          senderType: 'CUSTOMER',
          readByAdminAt: null,
          ...(scopedBranchId
            ? { conversation: { branchId: scopedBranchId } }
            : {}),
        },
      }),
    ]);

    return {
      summary: { open, waiting, resolved, unread },
      items: conversations.map((conversation) => ({
        id: conversation.id,
        status: conversation.status,
        lastMessageAt: conversation.lastMessageAt,
        firstResponseAt: conversation.firstResponseAt,
        resolvedAt: conversation.resolvedAt,
        reopenedCount: conversation.reopenedCount,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        customer: this.mapPerson(conversation.customer),
        branch: conversation.branch,
        relatedOrder: conversation.relatedOrder,
        lastMessage: conversation.messages[0] ?? null,
        unreadCount: conversation._count.messages,
      })),
    };
  }

  async getForManagement(
    viewerId: number,
    viewerRole: string,
    id: number,
    markCustomerMessagesRead = true,
  ) {
    const scopedBranchId =
      viewerRole === 'ADMIN'
        ? undefined
        : await this.resolveManagedBranchId(viewerId);
    await this.findConversation(id, scopedBranchId);
    if (markCustomerMessagesRead) {
      await this.prisma.supportMessage.updateMany({
        where: {
          conversationId: id,
          senderType: 'CUSTOMER',
          readByAdminAt: null,
        },
        data: { readByAdminAt: new Date() },
      });
    }
    return this.loadConversation(id);
  }

  async getManagementMetrics(
    viewerId: number,
    viewerRole: string,
    query: SupportMetricsQueryDto,
  ) {
    const days = query.days || 30;
    const scopedBranchId =
      viewerRole === 'ADMIN'
        ? query.branchId
        : await this.resolveManagedBranchId(viewerId);
    const since = new Date(Date.now() - days * 24 * 60 * 60_000);
    const overdueBefore = new Date(Date.now() - 10 * 60_000);
    const where: Prisma.SupportConversationWhereInput = {
      createdAt: { gte: since },
      ...(scopedBranchId ? { branchId: scopedBranchId } : {}),
    };

    const [conversations, branches] = await Promise.all([
      this.prisma.supportConversation.findMany({
        where,
        select: {
          branchId: true,
          status: true,
          createdAt: true,
          lastMessageAt: true,
          firstResponseAt: true,
          resolvedAt: true,
          reopenedCount: true,
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { senderType: true },
          },
        },
      }),
      this.prisma.storeBranch.findMany({
        where: {
          isActive: true,
          ...(scopedBranchId ? { id: scopedBranchId } : {}),
        },
        select: { id: true, code: true, name: true },
        orderBy: { code: 'asc' },
      }),
    ]);

    const summarize = (items: typeof conversations) => {
      const responded = items.filter((item) => item.firstResponseAt);
      const resolved = items.filter((item) => item.resolvedAt);
      const firstResponseMinutes = responded.map((item) =>
        Math.max(
          0,
          (item.firstResponseAt!.getTime() - item.createdAt.getTime()) / 60_000,
        ),
      );
      const resolutionMinutes = resolved.map((item) =>
        Math.max(
          0,
          (item.resolvedAt!.getTime() - item.createdAt.getTime()) / 60_000,
        ),
      );
      const average = (values: number[]) =>
        values.length
          ? Math.round(
              (values.reduce((total, value) => total + value, 0) /
                values.length) *
                10,
            ) / 10
          : null;
      const slaMet = firstResponseMinutes.filter(
        (minutes) => minutes <= 10,
      ).length;
      const overdue = items.filter(
        (item) =>
          item.status === SupportConversationStatus.OPEN &&
          item.lastMessageAt <= overdueBefore &&
          item.messages[0]?.senderType === 'CUSTOMER',
      ).length;

      return {
        total: items.length,
        open: items.filter(
          (item) => item.status === SupportConversationStatus.OPEN,
        ).length,
        resolved: resolved.length,
        overdue,
        reopened: items.reduce((total, item) => total + item.reopenedCount, 0),
        responded: responded.length,
        slaMet,
        slaBreached: responded.length - slaMet,
        slaMetRate: responded.length
          ? Math.round((slaMet / responded.length) * 1000) / 10
          : null,
        averageFirstResponseMinutes: average(firstResponseMinutes),
        averageResolutionMinutes: average(resolutionMinutes),
      };
    };

    const branchMetrics = branches
      .map((branch) => ({
        branch,
        ...summarize(
          conversations.filter((item) => item.branchId === branch.id),
        ),
      }))
      .sort(
        (left, right) =>
          right.overdue - left.overdue ||
          (left.averageFirstResponseMinutes ?? Number.MAX_SAFE_INTEGER) -
            (right.averageFirstResponseMinutes ?? Number.MAX_SAFE_INTEGER),
      );

    return {
      period: { days, from: since, to: new Date(), slaMinutes: 10 },
      summary: summarize(conversations),
      branches: branchMetrics,
    };
  }

  async sendBranchManagerMessage(
    managerId: number,
    id: number,
    rawContent: string,
  ) {
    const branchId = await this.resolveManagedBranchId(managerId);
    const conversation = await this.findConversation(id, branchId);
    const content = this.normalizeContent(rawContent);
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.supportConversation.update({
        where: { id },
        data: {
          status: SupportConversationStatus.WAITING_CUSTOMER,
          lastMessageAt: now,
          firstResponseAt: conversation.firstResponseAt ?? now,
          resolvedAt: null,
        },
      }),
      this.prisma.supportMessage.create({
        data: {
          conversationId: id,
          senderId: managerId,
          senderType: 'STAFF',
          content,
          readByAdminAt: now,
        },
      }),
      this.prisma.notification.create({
        data: {
          userId: conversation.customerId,
          type: 'SUPPORT_REPLY',
          title: 'Kippora đã phản hồi hỗ trợ',
          message:
            content.length > 120 ? `${content.slice(0, 117)}...` : content,
        },
      }),
    ]);

    await writeAuditLog(this.prisma, {
      actorId: managerId,
      branchId,
      module: 'SUPPORT',
      action: 'SEND_REPLY',
      entityType: 'SupportConversation',
      entityId: id,
      description: `Phản hồi hội thoại CSKH #${id}`,
      beforeData: { status: conversation.status },
      afterData: {
        status: SupportConversationStatus.WAITING_CUSTOMER,
        firstResponseAt: conversation.firstResponseAt ?? now,
      },
    });

    return this.loadConversation(id);
  }

  async updateStatus(
    managerId: number,
    id: number,
    status: SupportConversationStatus,
  ) {
    const branchId = await this.resolveManagedBranchId(managerId);
    const current = await this.findConversation(id, branchId);
    const now = new Date();
    const reopening =
      current.status === SupportConversationStatus.RESOLVED &&
      status !== SupportConversationStatus.RESOLVED;
    const updated = await this.prisma.supportConversation.update({
      where: { id },
      data: {
        status,
        resolvedAt:
          status === SupportConversationStatus.RESOLVED
            ? (current.resolvedAt ?? now)
            : null,
        ...(reopening ? { reopenedCount: { increment: 1 } } : {}),
      },
    });

    await writeAuditLog(this.prisma, {
      actorId: managerId,
      branchId,
      module: 'SUPPORT',
      action: 'UPDATE_STATUS',
      entityType: 'SupportConversation',
      entityId: id,
      description: `Cập nhật trạng thái hội thoại CSKH #${id}`,
      beforeData: {
        status: current.status,
        resolvedAt: current.resolvedAt,
        reopenedCount: current.reopenedCount,
      },
      afterData: {
        status: updated.status,
        resolvedAt: updated.resolvedAt,
        reopenedCount: updated.reopenedCount,
      },
    });

    return this.getForManagement(managerId, 'BRANCH_MANAGER', id, true);
  }

  async transferConversation(
    actorId: number,
    actorRole: string,
    id: number,
    targetBranchId: number,
  ) {
    const scopedBranchId =
      actorRole === 'ADMIN'
        ? undefined
        : await this.resolveManagedBranchId(actorId);
    const current = await this.findConversation(id, scopedBranchId);
    if (current.branchId === targetBranchId) return this.loadConversation(id);

    const targetBranch = await this.prisma.storeBranch.findFirst({
      where: { id: targetBranchId, isActive: true },
      select: { id: true, code: true, name: true },
    });
    if (!targetBranch) {
      throw new BadRequestException('Chi nhánh nhận hỗ trợ không hoạt động');
    }

    const duplicate = await this.prisma.supportConversation.findUnique({
      where: {
        customerId_branchId: {
          customerId: current.customerId,
          branchId: targetBranchId,
        },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException(
        `Khách đã có hội thoại #${duplicate.id} tại chi nhánh này`,
      );
    }

    const latestOrder = await this.prisma.order.findFirst({
      where: { userId: current.customerId, branchId: targetBranchId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true },
    });
    const targetManagers = await this.prisma.user.findMany({
      where: {
        isActive: true,
        role: { name: 'BRANCH_MANAGER' },
        managedBranch: { id: targetBranchId },
      },
      select: { id: true },
    });

    await this.prisma.$transaction([
      this.prisma.supportConversation.update({
        where: { id },
        data: {
          branchId: targetBranchId,
          relatedOrderId: latestOrder?.id ?? null,
        },
      }),
      ...(targetManagers.length
        ? [
            this.prisma.notification.createMany({
              data: targetManagers.map((manager) => ({
                userId: manager.id,
                type: 'SUPPORT_TRANSFERRED',
                title: 'Hội thoại CSKH được chuyển đến chi nhánh',
                message: `Hội thoại #${id} cần ${targetBranch.code} tiếp nhận.`,
              })),
            }),
          ]
        : []),
    ]);

    await writeAuditLog(this.prisma, {
      actorId,
      branchId: current.branchId,
      module: 'SUPPORT',
      action: 'TRANSFER_BRANCH',
      entityType: 'SupportConversation',
      entityId: id,
      description: `Chuyển hội thoại CSKH #${id} sang ${targetBranch.code}`,
      beforeData: {
        branchId: current.branchId,
        relatedOrderId: current.relatedOrderId,
      },
      afterData: {
        branchId: targetBranchId,
        relatedOrderId: latestOrder?.id ?? null,
      },
    });

    return this.loadConversation(id);
  }
}
