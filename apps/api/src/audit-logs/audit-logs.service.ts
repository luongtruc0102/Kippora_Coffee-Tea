import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import {
  flattenPersonProfile,
  personProfileSelect,
} from '../common/user-profiles/user-profiles.util';
import { PrismaService } from '../prisma/prisma.service';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveBranchId(
    viewerId: number,
    viewerRole: string,
    requestedBranchId?: number,
  ) {
    if (viewerRole === 'ADMIN') return requestedBranchId;
    const manager = await this.prisma.user.findUnique({
      where: { id: viewerId },
      select: {
        isActive: true,
        role: { select: { name: true } },
        staffProfile: { select: { branchId: true } },
        managedBranch: { select: { id: true } },
      },
    });
    if (
      !manager?.isActive ||
      manager.role.name !== 'BRANCH_MANAGER' ||
      !manager.managedBranch ||
      manager.staffProfile?.branchId !== manager.managedBranch.id
    ) {
      throw new ForbiddenException(
        'Tài khoản chưa được phân công quản lý chi nhánh',
      );
    }
    return manager.managedBranch.id;
  }

  async findAll(
    viewerId: number,
    viewerRole: string,
    query: ListAuditLogsDto,
  ) {
    const branchId = await this.resolveBranchId(
      viewerId,
      viewerRole,
      query.branchId,
    );
    const createdAt: Prisma.DateTimeFilter = {};
    if (query.from) createdAt.gte = new Date(`${query.from}T00:00:00+07:00`);
    if (query.to) {
      const end = new Date(`${query.to}T00:00:00+07:00`);
      end.setDate(end.getDate() + 1);
      createdAt.lt = end;
    }
    const keyword = query.q?.trim();
    const where: Prisma.AuditLogWhereInput = {
      ...(branchId ? { branchId } : {}),
      ...(query.module ? { module: query.module } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(Object.keys(createdAt).length ? { createdAt } : {}),
      ...(keyword
        ? {
            OR: [
              { description: { contains: keyword, mode: 'insensitive' } },
              { entityId: { contains: keyword, mode: 'insensitive' } },
              { actor: { email: { contains: keyword, mode: 'insensitive' } } },
              {
                actor: {
                  profile: {
                    fullName: { contains: keyword, mode: 'insensitive' },
                  },
                },
              },
            ],
          }
        : {}),
    };
    const page = query.page || 1;
    const limit = query.limit || 30;
    const [items, total, grouped, branches] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          actor: {
            select: { id: true, email: true, ...personProfileSelect },
          },
          branch: { select: { id: true, code: true, name: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.groupBy({
        by: ['module'],
        where,
        orderBy: { module: 'asc' },
        _count: { _all: true },
      }),
      viewerRole === 'ADMIN'
        ? this.prisma.storeBranch.findMany({
            select: { id: true, code: true, name: true },
            orderBy: { code: 'asc' },
          })
        : Promise.resolve([]),
    ]);

    return {
      items: items.map(({ actor, ...item }) => ({
        ...item,
        actor: actor ? flattenPersonProfile(actor) : null,
      })),
      summary: {
        total,
        byModule: Object.fromEntries(
          grouped.map((item) => [item.module, item._count._all]),
        ),
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      branches,
      scopedBranchId: branchId ?? null,
    };
  }
}
