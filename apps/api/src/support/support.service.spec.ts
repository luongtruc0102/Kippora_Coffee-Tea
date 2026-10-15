import { PrismaService } from '../prisma/prisma.service';
import { SupportService } from './support.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('SupportService', () => {
  const conversationFindUnique = jest.fn();
  const conversationFindFirst = jest.fn();
  const conversationFindMany = jest.fn();
  const conversationCount = jest.fn();
  const messageUpdateMany = jest.fn();
  const messageCount = jest.fn();
  const orderFindFirst = jest.fn();
  const branchFindFirst = jest.fn();
  const userFindUnique = jest.fn();
  const prisma = {
    supportConversation: {
      findUnique: conversationFindUnique,
      findFirst: conversationFindFirst,
      findMany: conversationFindMany,
      count: conversationCount,
    },
    supportMessage: {
      updateMany: messageUpdateMany,
      count: messageCount,
    },
    order: { findFirst: orderFindFirst },
    storeBranch: { findFirst: branchFindFirst },
    user: { findUnique: userFindUnique },
  } as unknown as PrismaService;
  const service = new SupportService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
    orderFindFirst.mockResolvedValue({ id: 99, branchId: 1 });
  });

  it('trả null khi khách chưa từng mở hội thoại', async () => {
    conversationFindUnique.mockResolvedValue(null);

    await expect(service.getCustomerConversation(10)).resolves.toBeNull();
    expect(messageUpdateMany).not.toHaveBeenCalled();
  });

  it('đánh dấu phản hồi của đội CSKH đã đọc khi khách mở hội thoại', async () => {
    const now = new Date();
    conversationFindUnique
      .mockResolvedValueOnce({ id: 7 })
      .mockResolvedValueOnce({
        id: 7,
        customerId: 10,
        status: 'WAITING_CUSTOMER',
        lastMessageAt: now,
        createdAt: now,
        updatedAt: now,
        customer: {
          id: 10,
          email: 'khach@example.com',
          profile: {
            fullName: 'Khách Kippora',
            phone: '0900000000',
            avatarUrl: null,
          },
        },
        messages: [
          {
            id: 1,
            conversationId: 7,
            senderId: 1,
            senderType: 'ADMIN',
            content: 'Kippora đã nhận được yêu cầu.',
            readByAdminAt: now,
            readByCustomerAt: null,
            createdAt: now,
            sender: {
              id: 1,
              email: 'admin@example.com',
              role: { name: 'ADMIN' },
              profile: {
                fullName: 'Admin',
                phone: null,
                avatarUrl: null,
              },
            },
          },
        ],
      });
    messageUpdateMany.mockResolvedValue({ count: 1 });

    const result = await service.getCustomerConversation(10);

    expect(messageUpdateMany).toHaveBeenCalledTimes(1);
    expect(result?.customer.fullName).toBe('Khách Kippora');
    expect(result?.messages[0].sender.fullName).toBe('Admin');
  });

  it('đếm số phản hồi CSKH mà khách chưa đọc', async () => {
    messageCount.mockResolvedValue(3);

    await expect(service.getCustomerUnreadCount(10)).resolves.toEqual({
      unreadCount: 3,
    });
    expect(messageCount).toHaveBeenCalledWith({
      where: {
        conversation: { customerId: 10 },
        senderType: { in: ['ADMIN', 'STAFF'] },
        readByCustomerAt: null,
      },
    });
  });

  it('tổng hợp đúng số hội thoại và tin chưa đọc cho Admin', async () => {
    const now = new Date();
    conversationFindMany.mockResolvedValue([
      {
        id: 3,
        status: 'OPEN',
        lastMessageAt: now,
        createdAt: now,
        updatedAt: now,
        customer: {
          id: 10,
          email: 'khach@example.com',
          profile: {
            fullName: 'Khách Kippora',
            phone: null,
            avatarUrl: null,
          },
        },
        messages: [
          {
            id: 8,
            conversationId: 3,
            senderId: 10,
            senderType: 'CUSTOMER',
            content: 'Mình cần hỗ trợ.',
            readByAdminAt: null,
            readByCustomerAt: now,
            createdAt: now,
          },
        ],
        _count: { messages: 2 },
      },
    ]);
    conversationCount
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3);
    messageCount.mockResolvedValue(2);

    const result = await service.listForManagement(1, 'ADMIN', {});

    expect(result.summary).toEqual({
      open: 1,
      waiting: 2,
      resolved: 3,
      unread: 2,
    });
    expect(result.items[0]).toMatchObject({
      id: 3,
      unreadCount: 2,
      customer: { fullName: 'Khách Kippora' },
    });
  });

  it('Admin giám sát không làm mất trạng thái chưa đọc của Nhân viên trưởng', async () => {
    const now = new Date();
    conversationFindFirst.mockResolvedValueOnce({
      id: 12,
      status: 'OPEN',
      customerId: 10,
      branchId: 1,
    });
    conversationFindUnique.mockResolvedValueOnce({
      id: 12,
      customerId: 10,
      branchId: 1,
      status: 'OPEN',
      lastMessageAt: now,
      createdAt: now,
      updatedAt: now,
      customer: {
        id: 10,
        email: 'khach@example.com',
        profile: { fullName: 'Khách', phone: null, avatarUrl: null },
      },
      messages: [],
    });

    await service.getForManagement(1, 'ADMIN', 12, false);

    expect(messageUpdateMany).not.toHaveBeenCalled();
  });

  it('Nhân viên trưởng chỉ tải hội thoại thuộc chi nhánh mình quản lý', async () => {
    userFindUnique.mockResolvedValue({
      managedBranch: { id: 2, isActive: true },
      staffProfile: { branchId: 2 },
    });
    conversationFindMany.mockResolvedValue([]);
    conversationCount.mockResolvedValue(0);
    messageCount.mockResolvedValue(0);

    await service.listForManagement(5, 'BRANCH_MANAGER', {});

    expect(conversationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { branchId: 2 } }),
    );
  });

  it('tính đúng SLA và thời gian phản hồi trung bình theo chi nhánh', async () => {
    const now = Date.now();
    const metricsService = new SupportService({
      supportConversation: {
        findMany: jest.fn().mockResolvedValue([
          {
            branchId: 1,
            status: 'OPEN',
            createdAt: new Date(now - 30 * 60_000),
            lastMessageAt: new Date(now - 20 * 60_000),
            firstResponseAt: new Date(now - 25 * 60_000),
            resolvedAt: null,
            reopenedCount: 1,
            messages: [{ senderType: 'CUSTOMER' }],
          },
          {
            branchId: 1,
            status: 'RESOLVED',
            createdAt: new Date(now - 120 * 60_000),
            lastMessageAt: new Date(now - 90 * 60_000),
            firstResponseAt: new Date(now - 100 * 60_000),
            resolvedAt: new Date(now - 60 * 60_000),
            reopenedCount: 0,
            messages: [{ senderType: 'STAFF' }],
          },
        ]),
      },
      storeBranch: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 1, code: 'Q9', name: 'Kippora Q9' }]),
      },
    } as unknown as PrismaService);

    const result = await metricsService.getManagementMetrics(1, 'ADMIN', {
      days: 30,
    });

    expect(result.summary).toMatchObject({
      total: 2,
      overdue: 1,
      reopened: 1,
      responded: 2,
      slaMet: 1,
      slaBreached: 1,
      slaMetRate: 50,
      averageFirstResponseMinutes: 12.5,
      averageResolutionMinutes: 60,
    });
    expect(result.branches[0]).toMatchObject({
      branch: { id: 1, code: 'Q9' },
      total: 2,
      overdue: 1,
    });
  });

  it('chuyển hội thoại sang chi nhánh khác và ghi nhật ký', async () => {
    const now = new Date();
    const conversationFindUniqueForTransfer = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 12,
        customerId: 10,
        branchId: 2,
        relatedOrderId: 101,
        status: 'OPEN',
        firstResponseAt: null,
        resolvedAt: null,
        reopenedCount: 0,
        lastMessageAt: now,
        createdAt: now,
        updatedAt: now,
        customer: {
          id: 10,
          email: 'khach@example.com',
          profile: { fullName: 'Khách', phone: null, avatarUrl: null },
        },
        branch: { id: 2, code: 'Q2', name: 'Kippora Q2', address: null },
        relatedOrder: {
          id: 101,
          status: 'CONFIRMED',
          branchId: 2,
          createdAt: now,
        },
        messages: [],
      });
    const conversationUpdate = jest.fn().mockResolvedValue({ id: 12 });
    let capturedAudit:
      | {
          data: { module: string; action: string; branchId: number | null };
        }
      | undefined;
    const auditCreate = jest.fn(
      (input: {
        data: { module: string; action: string; branchId: number | null };
      }) => {
        capturedAudit = input;
        return Promise.resolve({ id: 1 });
      },
    );
    const transferService = new SupportService({
      user: {
        findUnique: jest.fn().mockResolvedValue({
          managedBranch: { id: 1, isActive: true },
          staffProfile: { branchId: 1 },
        }),
        findMany: jest.fn().mockResolvedValue([{ id: 20 }]),
      },
      supportConversation: {
        findFirst: jest.fn().mockResolvedValue({
          id: 12,
          customerId: 10,
          branchId: 1,
          relatedOrderId: 99,
          status: 'OPEN',
          firstResponseAt: null,
          resolvedAt: null,
          reopenedCount: 0,
        }),
        findUnique: conversationFindUniqueForTransfer,
        update: conversationUpdate,
      },
      storeBranch: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 2, code: 'Q2', name: 'Kippora Q2' }),
      },
      order: { findFirst: jest.fn().mockResolvedValue({ id: 101 }) },
      notification: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      auditLog: { create: auditCreate },
      $transaction: jest.fn((queries: Array<Promise<unknown>>) =>
        Promise.all(queries),
      ),
    } as unknown as PrismaService);

    const result = await transferService.transferConversation(
      5,
      'BRANCH_MANAGER',
      12,
      2,
    );

    expect(conversationUpdate).toHaveBeenCalledWith({
      where: { id: 12 },
      data: { branchId: 2, relatedOrderId: 101 },
    });
    expect(capturedAudit?.data).toMatchObject({
      module: 'SUPPORT',
      action: 'TRANSFER_BRANCH',
      branchId: 1,
    });
    expect(result.branch.id).toBe(2);
  });
});
