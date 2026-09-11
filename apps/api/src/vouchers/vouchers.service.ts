import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FuzzySearchService } from '../common/fuzzy-search/fuzzy-search.service';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { UpdateVoucherDto } from './dto/update-voucher.dto';

@Injectable()
export class VouchersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fuzzySearch: FuzzySearchService,
  ) {}

  // Tạo voucher mới
  async create(createVoucherDto: CreateVoucherDto) {
    // Chuẩn hóa mã voucher để tránh trùng do viết hoa/thường
    const code = createVoucherDto.code.trim().toUpperCase();

    const existingVoucher = await this.prisma.voucher.findUnique({
      where: { code },
    });

    if (existingVoucher) {
      throw new ConflictException('Mã voucher đã tồn tại');
    }

    // Kiểm tra các rule nghiệp vụ trước khi lưu
    this.validateVoucherData(createVoucherDto);

    return this.prisma.voucher.create({
      data: {
        code,
        description: createVoucherDto.description,
        discountType: createVoucherDto.discountType as 'PERCENT' | 'FIXED',
        discountValue: createVoucherDto.discountValue,
        minOrderValue: createVoucherDto.minOrderValue,
        maxDiscount: createVoucherDto.maxDiscount,
        usageLimit: createVoucherDto.usageLimit,
        startAt: new Date(createVoucherDto.startAt),
        endAt: new Date(createVoucherDto.endAt),
      },
    });
  }

  // ADMIN xem toàn bộ voucher, kể cả voucher đã khóa
  async findAll(query = '') {
    const [vouchers, staffVoucherUsedCount] = await Promise.all([
      this.prisma.voucher.findMany({
        orderBy: {
          createdAt: 'desc',
        },
      }),

      // Đếm số lần mã đặc quyền nhân viên đã được sử dụng
      this.prisma.order.count({
        where: {
          voucherCode: 'NHANVIEN',
        },
      }),
    ]);

    const staffVoucher = {
      id: -1,

      code: 'NHANVIEN',

      description: 'Giảm 20% cho nhân viên',

      discountType: 'PERCENT' as const,

      discountValue: 20,

      minOrderValue: null,
      maxDiscount: null,

      // Không giới hạn lượt sử dụng
      usageLimit: null,

      // Lấy số lượt thực tế từ Order
      usedCount: staffVoucherUsedCount,

      startAt: null,
      endAt: null,

      isActive: true,

      createdAt: null,
      updatedAt: null,

      isSystemVoucher: true,
    };

    const results = [
      staffVoucher,

      ...vouchers.map((voucher) => ({
        ...voucher,
        isSystemVoucher: false,
      })),
    ];

    return this.fuzzySearch.search(results, query, {
      keys: [
        { name: 'code', weight: 0.65 },
        { name: 'description', weight: 0.25 },
        { name: 'discountType', weight: 0.1 },
      ],
    });
  }

  async findAvailableForCheckout(userId: number, subtotal: number) {
    if (!Number.isFinite(subtotal) || subtotal < 0) {
      throw new BadRequestException('Giá trị đơn hàng không hợp lệ');
    }

    const now = new Date();

    const [user, vouchers] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        include: { role: true },
      }),
      this.prisma.voucher.findMany({
        where: {
          isActive: true,
          startAt: { lte: now },
          endAt: { gte: now },
          OR: [
            { usageLimit: null },
            { usedCount: { lt: this.prisma.voucher.fields.usageLimit } },
          ],
        },
        orderBy: [{ minOrderValue: 'asc' }, { createdAt: 'desc' }],
      }),
    ]);

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    const availableVouchers = vouchers.map((voucher) => {
      const minOrderValue =
        voucher.minOrderValue === null ? 0 : Number(voucher.minOrderValue);
      const canUse = subtotal >= minOrderValue;

      let discountAmount = 0;

      if (canUse) {
        discountAmount =
          voucher.discountType === 'PERCENT'
            ? (subtotal * Number(voucher.discountValue)) / 100
            : Number(voucher.discountValue);

        if (voucher.maxDiscount !== null) {
          discountAmount = Math.min(
            discountAmount,
            Number(voucher.maxDiscount),
          );
        }

        discountAmount = Math.min(discountAmount, subtotal);
      }

      return {
        ...voucher,
        isSystemVoucher: false,
        canUse,
        unavailableReason: canUse
          ? null
          : `Đơn tối thiểu ${minOrderValue.toLocaleString('vi-VN')}đ`,
        discountAmount,
      };
    });

    if (user.role.name !== 'STAFF') {
      return availableVouchers;
    }

    return [
      {
        id: -1,
        code: 'NHANVIEN',
        description: 'Giảm 20% cho nhân viên',
        discountType: 'PERCENT' as const,
        discountValue: 20,
        minOrderValue: null,
        maxDiscount: null,
        usageLimit: null,
        usedCount: 0,
        startAt: null,
        endAt: null,
        isActive: true,
        createdAt: null,
        updatedAt: null,
        isSystemVoucher: true,
        canUse: true,
        unavailableReason: null,
        discountAmount: subtotal * 0.2,
      },
      ...availableVouchers,
    ];
  }

  // Tìm voucher theo id
  async findOne(id: number) {
    const voucher = await this.prisma.voucher.findUnique({
      where: { id },
    });

    if (!voucher) {
      throw new NotFoundException('Không tìm thấy voucher');
    }

    return voucher;
  }

  // Cập nhật thông tin voucher
  async update(id: number, updateVoucherDto: UpdateVoucherDto) {
    const voucher = await this.findOne(id);

    if (updateVoucherDto.code !== undefined) {
      // Chuẩn hóa mã voucher trước khi kiểm tra trùng
      const code = updateVoucherDto.code.trim().toUpperCase();

      const existingVoucher = await this.prisma.voucher.findFirst({
        where: {
          code,
          NOT: {
            id,
          },
        },
      });

      if (existingVoucher) {
        throw new ConflictException('Mã voucher đã tồn tại');
      }

      updateVoucherDto.code = code;
    }

    // Ghép dữ liệu cũ và dữ liệu mới để validate toàn bộ voucher
    this.validateVoucherData({
      discountType: updateVoucherDto.discountType ?? voucher.discountType,

      discountValue:
        updateVoucherDto.discountValue ?? Number(voucher.discountValue),

      minOrderValue:
        updateVoucherDto.minOrderValue !== undefined
          ? updateVoucherDto.minOrderValue
          : voucher.minOrderValue !== null
            ? Number(voucher.minOrderValue)
            : null,

      maxDiscount:
        updateVoucherDto.maxDiscount !== undefined
          ? updateVoucherDto.maxDiscount
          : voucher.maxDiscount !== null
            ? Number(voucher.maxDiscount)
            : null,

      usageLimit:
        updateVoucherDto.usageLimit !== undefined
          ? updateVoucherDto.usageLimit
          : voucher.usageLimit,

      startAt: updateVoucherDto.startAt ?? voucher.startAt.toISOString(),

      endAt: updateVoucherDto.endAt ?? voucher.endAt.toISOString(),
    });

    // Chỉ cập nhật các field client thực sự gửi lên
    return this.prisma.voucher.update({
      where: { id },
      data: {
        ...(updateVoucherDto.code !== undefined && {
          code: updateVoucherDto.code,
        }),

        ...(updateVoucherDto.description !== undefined && {
          description: updateVoucherDto.description,
        }),

        ...(updateVoucherDto.discountType !== undefined && {
          discountType: updateVoucherDto.discountType as 'PERCENT' | 'FIXED',
        }),

        ...(updateVoucherDto.discountValue !== undefined && {
          discountValue: updateVoucherDto.discountValue,
        }),

        ...(updateVoucherDto.minOrderValue !== undefined && {
          minOrderValue: updateVoucherDto.minOrderValue,
        }),

        ...(updateVoucherDto.maxDiscount !== undefined && {
          maxDiscount: updateVoucherDto.maxDiscount,
        }),

        ...(updateVoucherDto.usageLimit !== undefined && {
          usageLimit: updateVoucherDto.usageLimit,
        }),

        ...(updateVoucherDto.startAt !== undefined && {
          startAt: new Date(updateVoucherDto.startAt),
        }),

        ...(updateVoucherDto.endAt !== undefined && {
          endAt: new Date(updateVoucherDto.endAt),
        }),
      },
    });
  }

  // Soft lock voucher, không xóa khỏi database
  async updateStatus(id: number, isActive: boolean) {
    await this.findOne(id);

    return this.prisma.voucher.update({
      where: { id },
      data: {
        isActive,
      },
    });
  }

  // Kiểm tra voucher trước khi áp dụng vào checkout
  async validateForCheckout(code: string, subtotal: number, userId: number) {
    const normalizedCode = code.trim().toUpperCase();

    // Voucher cố định dành riêng cho nhân viên
    if (normalizedCode === 'NHANVIEN') {
      const user = await this.prisma.user.findUnique({
        where: {
          id: userId,
        },

        include: {
          role: true,
        },
      });

      if (!user || user.role.name !== 'STAFF') {
        throw new BadRequestException('Mã NHANVIEN chỉ dành cho nhân viên');
      }

      return {
        voucher: null,

        voucherCode: 'NHANVIEN',

        discountAmount: subtotal * 0.2,
      };
    }

    const voucher = await this.prisma.voucher.findUnique({
      where: {
        code: normalizedCode,
      },
    });

    // Voucher phải tồn tại và đang hoạt động
    if (!voucher || !voucher.isActive) {
      throw new BadRequestException('Voucher không tồn tại hoặc đã bị khóa');
    }

    const now = new Date();

    // Voucher chỉ sử dụng được trong thời gian hiệu lực
    if (now < voucher.startAt || now > voucher.endAt) {
      throw new BadRequestException('Voucher chưa có hiệu lực hoặc đã hết hạn');
    }

    // Kiểm tra giới hạn số lượt sử dụng
    if (
      voucher.usageLimit !== null &&
      voucher.usedCount >= voucher.usageLimit
    ) {
      throw new BadRequestException('Voucher đã hết lượt sử dụng');
    }

    // Kiểm tra giá trị đơn hàng tối thiểu
    if (
      voucher.minOrderValue !== null &&
      subtotal < Number(voucher.minOrderValue)
    ) {
      throw new BadRequestException(
        `Đơn hàng phải đạt tối thiểu ${Number(
          voucher.minOrderValue,
        )} để sử dụng voucher`,
      );
    }

    let discountAmount = 0;

    if (voucher.discountType === 'PERCENT') {
      // Tính tiền giảm theo phần trăm
      discountAmount = (subtotal * Number(voucher.discountValue)) / 100;

      // Giới hạn số tiền giảm tối đa nếu voucher có maxDiscount
      if (voucher.maxDiscount !== null) {
        discountAmount = Math.min(discountAmount, Number(voucher.maxDiscount));
      }
    } else {
      // Voucher FIXED giảm trực tiếp một số tiền cố định
      discountAmount = Number(voucher.discountValue);
    }

    // Không cho voucher giảm vượt quá giá trị đơn hàng
    discountAmount = Math.min(discountAmount, subtotal);

    return {
      voucher,
      voucherCode: voucher.code,
      discountAmount,
    };
  }

  // Validate các rule nghiệp vụ chung của voucher
  private validateVoucherData(data: {
    discountType: string;
    discountValue: number;
    minOrderValue?: number | null;
    maxDiscount?: number | null;
    usageLimit?: number | null;
    startAt: string;
    endAt: string;
  }) {
    const startAt = new Date(data.startAt);
    const endAt = new Date(data.endAt);

    // Thời gian bắt đầu phải trước thời gian kết thúc
    if (startAt >= endAt) {
      throw new BadRequestException(
        'Thời gian bắt đầu phải trước thời gian kết thúc',
      );
    }

    // Voucher phần trăm không được vượt quá 100%
    if (data.discountType === 'PERCENT' && data.discountValue > 100) {
      throw new BadRequestException(
        'Voucher phần trăm không được giảm quá 100%',
      );
    }

    // Giá trị giảm phải là số dương
    if (data.discountValue <= 0) {
      throw new BadRequestException('Giá trị giảm phải lớn hơn 0');
    }

    // Nếu có giới hạn lượt dùng thì phải ít nhất là 1
    if (
      data.usageLimit !== undefined &&
      data.usageLimit !== null &&
      data.usageLimit < 1
    ) {
      throw new BadRequestException('Giới hạn sử dụng phải lớn hơn 0');
    }
  }
}
