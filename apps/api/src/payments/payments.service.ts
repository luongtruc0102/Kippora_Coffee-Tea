import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import {
  flattenPersonProfile,
  personProfileSelect,
} from '../common/user-profiles/user-profiles.util';
import { createBankTransferMetadata } from './payment-reference.util';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  // Tạo thông tin thanh toán cho đơn hàng của chính user
  async create(
    userId: number,
    orderId: number,
    createPaymentDto: CreatePaymentDto,
  ) {
    // User chỉ được tạo Payment cho Order thuộc tài khoản của mình
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
      },
      include: {
        payment: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    // Mỗi Order chỉ có một Payment
    if (order.payment) {
      throw new ConflictException('Đơn hàng đã có thông tin thanh toán');
    }

    // Không cho thanh toán đơn đã bị hủy
    if (order.status === 'CANCELLED') {
      throw new BadRequestException('Không thể thanh toán đơn hàng đã bị hủy');
    }

    // Không tạo Payment mới cho đơn đã hoàn tất
    if (order.status === 'COMPLETED') {
      throw new BadRequestException(
        'Không thể tạo thanh toán cho đơn hàng đã hoàn tất',
      );
    }

    return this.prisma.payment.create({
      data: {
        orderId,

        method: createPaymentDto.method as 'COD' | 'BANK_TRANSFER',
        ...createBankTransferMetadata(createPaymentDto.method),

        // Không nhận amount từ client, luôn lấy tổng tiền từ Order
        amount: order.totalPrice,
      },
    });
  }

  // User xem thông tin thanh toán của Order thuộc chính mình
  async findMyPayment(userId: number, orderId: number) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        orderId,
        order: {
          userId,
        },
      },
      include: {
        order: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Không tìm thấy thông tin thanh toán');
    }

    return payment;
  }

  // ADMIN/STAFF xem toàn bộ thông tin thanh toán
  async findAll() {
    const payments = await this.prisma.payment.findMany({
      include: {
        refund: true,
        order: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                ...personProfileSelect,
              },
            },
            branch: {
              select: {
                id: true,
                code: true,
                name: true,
                address: true,
                phone: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return payments.map(({ order, ...payment }) => ({
      ...payment,
      order: {
        ...order,
        user: flattenPersonProfile(order.user),
      },
    }));
  }

  // ADMIN/STAFF cập nhật trạng thái thanh toán
  async updateStatus(
    id: number,
    updatePaymentStatusDto: UpdatePaymentStatusDto,
  ) {
    const payment = await this.prisma.payment.findUnique({
      where: {
        id,
      },
    });

    if (!payment) {
      throw new NotFoundException('Không tìm thấy thông tin thanh toán');
    }

    // Payment đã PAID là trạng thái cuối, không được thay đổi lại
    if (payment.status === 'PAID') {
      throw new BadRequestException(
        'Thanh toán đã hoàn tất và không thể thay đổi',
      );
    }

    // Kiểm soát các bước chuyển trạng thái hợp lệ
    const allowedTransitions: Record<string, string[]> = {
      PENDING: ['PAID', 'FAILED', 'CANCELLED'],
      FAILED: ['PENDING'],
      CANCELLED: [],
    };

    const allowedStatuses = allowedTransitions[payment.status] ?? [];

    if (!allowedStatuses.includes(updatePaymentStatusDto.status)) {
      throw new BadRequestException(
        `Không thể chuyển trạng thái thanh toán từ ${payment.status} sang ${updatePaymentStatusDto.status}`,
      );
    }

    // Chuyển khoản thành công phải có mã giao dịch để đối soát
    if (
      payment.method === 'BANK_TRANSFER' &&
      updatePaymentStatusDto.status === 'PAID'
    ) {
      throw new BadRequestException(
        'Chuyển khoản chỉ được xác nhận qua đối soát ngân hàng',
      );
    }

    return this.prisma.payment.update({
      where: {
        id,
      },
      data: {
        status: updatePaymentStatusDto.status as
          'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED',

        transactionCode: updatePaymentStatusDto.transactionCode,

        // Chỉ ghi thời gian khi thanh toán thực sự thành công
        paidAt: updatePaymentStatusDto.status === 'PAID' ? new Date() : null,
      },
    });
  }
}
