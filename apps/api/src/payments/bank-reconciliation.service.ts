import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import type { Prisma } from '../../generated/prisma/client';
import type { BankTransactionStatus } from '../../generated/prisma/enums';
import { writeAuditLog } from '../common/audit-logs/audit-log.util';
import { PrismaService } from '../prisma/prisma.service';
import { ListBankTransactionsDto } from './dto/list-bank-transactions.dto';
import { ReceiveBankTransactionDto } from './dto/receive-bank-transaction.dto';
import {
  IgnoreBankTransactionDto,
  MatchBankTransactionDto,
} from './dto/resolve-bank-transaction.dto';
import { UpsertBankAccountDto } from './dto/upsert-bank-account.dto';
import { createBankTransferMetadata } from './payment-reference.util';
import { buildVietQrPayload } from './vietqr-payload.util';

const unresolvedStatuses: BankTransactionStatus[] = [
  'UNMATCHED',
  'AMOUNT_MISMATCH',
  'DUPLICATE',
];

const instructionInclude = {
  order: {
    include: {
      branch: { include: { bankAccount: true } },
    },
  },
} as const;

type InstructionPayment = Prisma.PaymentGetPayload<{
  include: typeof instructionInclude;
}>;

function todayInVietnam() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function dateRange(from?: string, to?: string) {
  const startKey = from ?? todayInVietnam();
  const endKey = to ?? startKey;
  if (startKey > endKey) {
    throw new BadRequestException('Ngày bắt đầu không được sau ngày kết thúc');
  }
  const start = new Date(`${startKey}T00:00:00+07:00`);
  const end = new Date(`${endKey}T00:00:00+07:00`);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end, startKey, endKey };
}

@Injectable()
export class BankReconciliationService {
  constructor(private readonly prisma: PrismaService) {}

  verifyWebhookSecret(value?: string) {
    const expected = process.env.BANK_WEBHOOK_SECRET?.trim();
    if (!expected) {
      throw new ServiceUnavailableException(
        'Webhook ngân hàng chưa được cấu hình',
      );
    }
    const received = value?.trim() ?? '';
    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(received);
    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      throw new UnauthorizedException('Chữ ký webhook không hợp lệ');
    }
  }

  private extractReference(description: string) {
    return description.toUpperCase().match(/KIP[A-Z0-9]{4,29}/)?.[0] ?? null;
  }

  private async refreshReference(payment: {
    id: number;
    referenceCode: string | null;
    expiresAt: Date | null;
    status: string;
  }) {
    const hasExpired =
      payment.status === 'PENDING' &&
      payment.expiresAt !== null &&
      payment.expiresAt.getTime() <= Date.now();
    if (payment.referenceCode && !hasExpired) return payment;

    const metadata = payment.referenceCode
      ? { expiresAt: createBankTransferMetadata('BANK_TRANSFER').expiresAt }
      : createBankTransferMetadata('BANK_TRANSFER');
    return this.prisma.payment.update({
      where: { id: payment.id },
      data: metadata,
    });
  }

  private async buildInstruction(payment: InstructionPayment) {
    if (!payment || !payment.order) {
      throw new NotFoundException('Không tìm thấy thanh toán');
    }
    if (payment.method !== 'BANK_TRANSFER') {
      throw new BadRequestException(
        'Đơn hàng không thanh toán bằng chuyển khoản',
      );
    }
    const account = payment.order.branch.bankAccount;
    if (!account?.isActive) {
      throw new BadRequestException(
        'Chi nhánh chưa cấu hình tài khoản nhận chuyển khoản',
      );
    }
    const refreshed = await this.refreshReference(payment);
    const referenceCode = refreshed.referenceCode;
    if (!referenceCode) {
      throw new BadRequestException('Không thể tạo mã thanh toán');
    }
    const amount = Math.round(Number(payment.amount));
    return {
      paymentId: payment.id,
      orderId: payment.order.id,
      status: payment.status,
      amount,
      referenceCode,
      expiresAt: refreshed.expiresAt,
      serverTime: new Date(),
      bankAccount: {
        bankBin: account.bankBin,
        bankCode: account.bankCode,
        bankName: account.bankName,
        accountNumber: account.accountNumber,
        accountName: account.accountName,
      },
      qrPayload: buildVietQrPayload({
        bankBin: account.bankBin,
        accountNumber: account.accountNumber,
        amount,
        referenceCode,
      }),
    };
  }

  async getCustomerInstruction(userId: number, orderId: number) {
    const payment = await this.prisma.payment.findFirst({
      where: { orderId, order: { userId } },
      include: instructionInclude,
    });
    if (!payment) throw new NotFoundException('Không tìm thấy thanh toán');
    return this.buildInstruction(payment);
  }

  async getManagedInstruction(
    viewerId: number,
    viewerRole: string,
    paymentId: number,
  ) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: instructionInclude,
    });
    if (!payment) throw new NotFoundException('Không tìm thấy thanh toán');

    if (viewerRole !== 'ADMIN') {
      const staff = await this.prisma.staffProfile.findUnique({
        where: { userId: viewerId },
        select: { branchId: true },
      });
      if (!staff?.branchId || staff.branchId !== payment.order.branchId) {
        throw new NotFoundException('Không tìm thấy thanh toán tại chi nhánh');
      }
    }
    return this.buildInstruction(payment);
  }

  async getBankAccounts() {
    return this.prisma.storeBranch.findMany({
      orderBy: [{ isActive: 'desc' }, { code: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        isActive: true,
        bankAccount: true,
      },
    });
  }

  async upsertBankAccount(
    actorId: number,
    branchId: number,
    dto: UpsertBankAccountDto,
  ) {
    const branch = await this.prisma.storeBranch.findUnique({
      where: { id: branchId },
      select: { id: true, code: true, name: true },
    });
    if (!branch) throw new NotFoundException('Không tìm thấy chi nhánh');
    const before = await this.prisma.branchBankAccount.findUnique({
      where: { branchId },
    });
    const normalized = {
      bankBin: dto.bankBin,
      bankCode: dto.bankCode.trim().toUpperCase(),
      bankName: dto.bankName.trim(),
      accountNumber: dto.accountNumber.trim().toUpperCase(),
      accountName: dto.accountName.trim().toUpperCase(),
      isActive: dto.isActive,
    };
    const account = await this.prisma.branchBankAccount.upsert({
      where: { branchId },
      create: { branchId, ...normalized },
      update: normalized,
    });
    await writeAuditLog(this.prisma, {
      actorId,
      branchId,
      module: 'PAYMENT',
      action: before ? 'UPDATE_BANK_ACCOUNT' : 'CREATE_BANK_ACCOUNT',
      entityType: 'BranchBankAccount',
      entityId: account.id,
      description: `${before ? 'Cập nhật' : 'Cấu hình'} tài khoản nhận chuyển khoản cho ${branch.code} - ${branch.name}`,
      beforeData: before,
      afterData: account,
    });
    return account;
  }

  private transactionInclude() {
    return {
      bankAccount: {
        include: { branch: { select: { id: true, code: true, name: true } } },
      },
      matchedPayment: {
        include: {
          order: {
            select: {
              id: true,
              receiverName: true,
              receiverPhone: true,
              channel: true,
            },
          },
        },
      },
      resolvedBy: {
        select: {
          id: true,
          email: true,
          profile: { select: { fullName: true } },
        },
      },
    } as const;
  }

  private async loadTransaction(id: number) {
    return this.prisma.bankTransaction.findUnique({
      where: { id },
      include: this.transactionInclude(),
    });
  }

  async receiveTransaction(
    dto: ReceiveBankTransactionDto,
    actorId: number | null,
    rawPayload: unknown,
  ) {
    const account = await this.prisma.branchBankAccount.findFirst({
      where: {
        bankBin: dto.bankBin,
        accountNumber: dto.accountNumber.trim().toUpperCase(),
        isActive: true,
      },
      include: { branch: true },
    });
    if (!account) {
      throw new NotFoundException('Không tìm thấy tài khoản nhận tiền phù hợp');
    }

    const providerReference = dto.providerReference.trim();
    const duplicateKey = {
      bankAccountId_providerReference: {
        bankAccountId: account.id,
        providerReference,
      },
    };
    const existing = await this.prisma.bankTransaction.findUnique({
      where: duplicateKey,
      include: this.transactionInclude(),
    });
    if (existing) return { transaction: existing, duplicateDelivery: true };

    const referenceCode = this.extractReference(dto.description);
    const payment = referenceCode
      ? await this.prisma.payment.findUnique({
          where: { referenceCode },
          include: {
            bankTransaction: true,
            order: {
              select: { id: true, branchId: true, userId: true, channel: true },
            },
          },
        })
      : null;
    const sameBranch = payment?.order.branchId === account.branchId;
    const amountMatches = payment
      ? Number(payment.amount) === Number(dto.amount)
      : false;
    const canMatch =
      payment?.method === 'BANK_TRANSFER' &&
      payment.status === 'PENDING' &&
      !payment.bankTransaction &&
      sameBranch &&
      amountMatches;
    let initialStatus: BankTransactionStatus = 'UNMATCHED';
    if (payment && sameBranch && !amountMatches)
      initialStatus = 'AMOUNT_MISMATCH';
    if (payment && (payment.status !== 'PENDING' || payment.bankTransaction)) {
      initialStatus = 'DUPLICATE';
    }

    let createdId: number;
    try {
      createdId = await this.prisma.$transaction(async (tx) => {
        const created = await tx.bankTransaction.create({
          data: {
            bankAccountId: account.id,
            providerReference,
            amount: dto.amount,
            description: dto.description.trim(),
            occurredAt: new Date(dto.occurredAt),
            status: initialStatus,
            rawPayload: JSON.parse(
              JSON.stringify(rawPayload),
            ) as Prisma.InputJsonValue,
          },
        });
        if (!canMatch || !payment) return created.id;

        const claimed = await tx.payment.updateMany({
          where: {
            id: payment.id,
            status: 'PENDING',
            method: 'BANK_TRANSFER',
            bankTransaction: null,
          },
          data: {
            status: 'PAID',
            transactionCode: providerReference,
            paidAt: new Date(dto.occurredAt),
          },
        });
        if (claimed.count === 0) {
          await tx.bankTransaction.update({
            where: { id: created.id },
            data: { status: 'DUPLICATE' },
          });
          return created.id;
        }
        await tx.bankTransaction.update({
          where: { id: created.id },
          data: {
            status: 'MATCHED',
            matchedPaymentId: payment.id,
            matchedAt: new Date(),
            resolvedById: actorId,
            resolutionNote: actorId
              ? 'Giao dịch thử được hệ thống tự động đối soát'
              : 'Webhook được hệ thống tự động đối soát',
          },
        });
        if (payment.order.channel === 'ONLINE') {
          await tx.notification.create({
            data: {
              userId: payment.order.userId,
              orderId: payment.order.id,
              type: 'PAYMENT_CONFIRMED',
              title: 'Đã nhận thanh toán',
              message: `Đơn #${payment.order.id} đã được xác nhận chuyển khoản thành công.`,
            },
          });
        }
        return created.id;
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        const duplicate = await this.prisma.bankTransaction.findUnique({
          where: duplicateKey,
          include: this.transactionInclude(),
        });
        if (duplicate) {
          return { transaction: duplicate, duplicateDelivery: true };
        }
      }
      throw error;
    }

    const transaction = await this.loadTransaction(createdId);
    await writeAuditLog(this.prisma, {
      actorId,
      branchId: account.branchId,
      module: 'PAYMENT',
      action:
        transaction?.status === 'MATCHED'
          ? 'AUTO_MATCH'
          : 'RECEIVE_BANK_TRANSACTION',
      entityType: 'BankTransaction',
      entityId: createdId,
      description:
        transaction?.status === 'MATCHED'
          ? `Tự động đối soát giao dịch ${dto.providerReference}`
          : `Nhận giao dịch ${dto.providerReference} cần kiểm tra`,
      afterData: transaction,
      metadata: { referenceCode },
    });
    if (transaction && transaction.status !== 'MATCHED') {
      const admins = await this.prisma.user.findMany({
        where: { isActive: true, role: { name: 'ADMIN' } },
        select: { id: true },
      });
      const recipientIds = [...new Set(admins.map((admin) => admin.id))];
      if (recipientIds.length) {
        const amountMismatch = transaction.status === 'AMOUNT_MISMATCH';
        await this.prisma.notification.createMany({
          data: recipientIds.map((userId) => ({
            userId,
            dedupeKey: `BANK_RECONCILIATION:${transaction.id}`,
            type: amountMismatch
              ? 'BANK_RECONCILIATION_AMOUNT_MISMATCH'
              : 'BANK_RECONCILIATION_UNMATCHED',
            title: amountMismatch
              ? 'Chuyển khoản sai số tiền'
              : 'Có chuyển khoản chưa khớp',
            message: `${account.branch.code} · giao dịch ${transaction.providerReference} · ${Number(transaction.amount).toLocaleString('vi-VN')} đ cần Admin kiểm tra.`,
          })),
          skipDuplicates: true,
        });
      }
    }
    return { transaction, duplicateDelivery: false };
  }

  async listTransactions(query: ListBankTransactionsDto) {
    const range = dateRange(query.from, query.to);
    const where = {
      occurredAt: { gte: range.start, lt: range.end },
      ...(query.branchId ? { bankAccount: { branchId: query.branchId } } : {}),
      ...(query.status && query.status !== 'ALL'
        ? { status: query.status as BankTransactionStatus }
        : {}),
    };
    const [transactions, pendingPayments] = await Promise.all([
      this.prisma.bankTransaction.findMany({
        where,
        include: this.transactionInclude(),
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take: 500,
      }),
      this.prisma.payment.findMany({
        where: {
          method: 'BANK_TRANSFER',
          status: 'PENDING',
          referenceCode: { not: null },
          ...(query.branchId ? { order: { branchId: query.branchId } } : {}),
        },
        include: {
          order: {
            select: {
              id: true,
              branchId: true,
              receiverName: true,
              receiverPhone: true,
              branch: { select: { code: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 300,
      }),
    ]);
    const paymentByReference = new Map(
      pendingPayments
        .filter((payment) => payment.referenceCode)
        .map((payment) => [payment.referenceCode!, payment]),
    );
    const rows = transactions.map((transaction) => {
      const reference = this.extractReference(transaction.description);
      return {
        ...transaction,
        amount: Number(transaction.amount),
        suggestedPayment:
          transaction.matchedPayment ??
          (reference ? (paymentByReference.get(reference) ?? null) : null),
      };
    });
    const summary = rows.reduce(
      (result, row) => {
        result.totalCount += 1;
        result.totalAmount += row.amount;
        if (row.status === 'MATCHED') {
          result.matchedCount += 1;
          result.matchedAmount += row.amount;
        } else if (unresolvedStatuses.includes(row.status)) {
          result.unresolvedCount += 1;
          result.unresolvedAmount += row.amount;
        }
        return result;
      },
      {
        totalCount: 0,
        totalAmount: 0,
        matchedCount: 0,
        matchedAmount: 0,
        unresolvedCount: 0,
        unresolvedAmount: 0,
      },
    );
    return {
      range: { from: range.startKey, to: range.endKey },
      summary,
      transactions: rows,
      pendingPayments: pendingPayments.map((payment) => ({
        ...payment,
        amount: Number(payment.amount),
      })),
    };
  }

  async matchManually(
    actorId: number,
    transactionId: number,
    dto: MatchBankTransactionDto,
  ) {
    const transaction = await this.prisma.bankTransaction.findUnique({
      where: { id: transactionId },
      include: { bankAccount: true },
    });
    if (!transaction) throw new NotFoundException('Không tìm thấy giao dịch');
    if (transaction.status === 'MATCHED' || transaction.status === 'IGNORED') {
      throw new BadRequestException('Giao dịch này đã được xử lý');
    }
    const payment = await this.prisma.payment.findUnique({
      where: { id: dto.paymentId },
      include: { bankTransaction: true, order: true },
    });
    if (!payment) throw new NotFoundException('Không tìm thấy thanh toán');
    if (
      payment.method !== 'BANK_TRANSFER' ||
      payment.status !== 'PENDING' ||
      payment.bankTransaction
    ) {
      throw new BadRequestException('Thanh toán không còn chờ đối soát');
    }
    if (payment.order.branchId !== transaction.bankAccount.branchId) {
      throw new BadRequestException('Giao dịch và đơn hàng khác chi nhánh');
    }
    if (Number(payment.amount) !== Number(transaction.amount)) {
      throw new BadRequestException(
        'Số tiền không khớp; không thể xác nhận tự động. Hãy hoàn hoặc thu bổ sung trước.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.payment.updateMany({
        where: {
          id: payment.id,
          method: 'BANK_TRANSFER',
          status: 'PENDING',
          bankTransaction: null,
        },
        data: {
          status: 'PAID',
          transactionCode: transaction.providerReference,
          paidAt: transaction.occurredAt,
        },
      });
      if (claimed.count === 0) {
        throw new ConflictException(
          'Thanh toán vừa được đối soát ở phiên khác',
        );
      }
      await tx.bankTransaction.update({
        where: { id: transaction.id },
        data: {
          status: 'MATCHED',
          matchedPaymentId: payment.id,
          matchedAt: new Date(),
          resolvedById: actorId,
          resolutionNote: dto.note.trim(),
        },
      });
      if (payment.order.channel === 'ONLINE') {
        await tx.notification.create({
          data: {
            userId: payment.order.userId,
            orderId: payment.order.id,
            type: 'PAYMENT_CONFIRMED',
            title: 'Đã nhận thanh toán',
            message: `Đơn #${payment.order.id} đã được xác nhận chuyển khoản thành công.`,
          },
        });
      }
    });
    const result = await this.loadTransaction(transaction.id);
    await writeAuditLog(this.prisma, {
      actorId,
      branchId: transaction.bankAccount.branchId,
      module: 'PAYMENT',
      action: 'MANUAL_MATCH',
      entityType: 'BankTransaction',
      entityId: transaction.id,
      description: `Ghép thủ công giao dịch ${transaction.providerReference} với thanh toán #${payment.id}`,
      beforeData: transaction,
      afterData: result,
      metadata: { note: dto.note },
    });
    return result;
  }

  async ignore(
    actorId: number,
    transactionId: number,
    dto: IgnoreBankTransactionDto,
  ) {
    const transaction = await this.prisma.bankTransaction.findUnique({
      where: { id: transactionId },
      include: { bankAccount: true },
    });
    if (!transaction) throw new NotFoundException('Không tìm thấy giao dịch');
    if (transaction.status === 'MATCHED') {
      throw new BadRequestException('Không thể bỏ qua giao dịch đã khớp');
    }
    const result = await this.prisma.bankTransaction.update({
      where: { id: transactionId },
      data: {
        status: 'IGNORED',
        resolutionNote: dto.reason.trim(),
        resolvedById: actorId,
      },
      include: this.transactionInclude(),
    });
    await writeAuditLog(this.prisma, {
      actorId,
      branchId: transaction.bankAccount.branchId,
      module: 'PAYMENT',
      action: 'IGNORE_BANK_TRANSACTION',
      entityType: 'BankTransaction',
      entityId: transaction.id,
      description: `Bỏ qua giao dịch ${transaction.providerReference}`,
      beforeData: transaction,
      afterData: result,
      metadata: { reason: dto.reason },
    });
    return result;
  }
}
