import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateAcceptingOrdersDto } from './dto/update-accepting-orders.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { UpdateStoreSettingsDto } from './dto/update-store-settings.dto';
import {
  flattenPersonProfile,
  personProfileSelect,
} from '../common/user-profiles/user-profiles.util';
const STORE_SETTINGS_ID = 1;
const DEFAULT_BRANCH_CODE = 'MAIN';
const STORE_TIME_ZONE = 'Asia/Ho_Chi_Minh';

@Injectable()
export class StoreSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private getCurrentMinutes() {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: STORE_TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date());

    const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
    const minute = Number(
      parts.find((part) => part.type === 'minute')?.value ?? 0,
    );

    return hour * 60 + minute;
  }

  private parseTime(value: string) {
    const [hour, minute] = value.split(':').map(Number);

    return hour * 60 + minute;
  }

  private isWithinOpeningHours(openingTime: string, closingTime: string) {
    const openingMinutes = this.parseTime(openingTime);
    const closingMinutes = this.parseTime(closingTime);
    const currentMinutes = this.getCurrentMinutes();

    // Hai mốc giống nhau được hiểu là cửa hàng mở 24 giờ.
    if (openingMinutes === closingMinutes) {
      return true;
    }

    if (openingMinutes < closingMinutes) {
      return (
        currentMinutes >= openingMinutes && currentMinutes < closingMinutes
      );
    }

    // Hỗ trợ khung giờ đi qua nửa đêm, ví dụ 18:00 - 02:00.
    return currentMinutes >= openingMinutes || currentMinutes < closingMinutes;
  }

  private async getOrCreate() {
    return this.prisma.storeSettings.upsert({
      where: { id: STORE_SETTINGS_ID },
      update: {},
      create: { id: STORE_SETTINGS_ID },
    });
  }

  // Hiện tại hệ thống dùng chi nhánh MAIN; sau này lấy code/id từ Staff và Order.
  private async getOrCreateDefaultBranch() {
    return this.prisma.storeBranch.upsert({
      where: { code: DEFAULT_BRANCH_CODE },
      update: {},
      create: {
        code: DEFAULT_BRANCH_CODE,
        name: 'Kippora - Chi nhánh chính',
      },
    });
  }

  // Chọn một chi nhánh có thể nhận đơn để User và checkout dùng cùng kết quả.
  // Khi checkout đã chọn branchId, lần kiểm tra cuối phải xác minh đúng chi nhánh đó.
  private async resolveOrderBranch(branchId?: number) {
    if (branchId !== undefined) {
      return this.prisma.storeBranch.findUnique({
        where: { id: branchId },
        include: { bankAccount: true },
      });
    }

    const availableBranch = await this.prisma.storeBranch.findFirst({
      where: {
        isActive: true,
        isAcceptingOrders: true,
        address: { not: null },
        latitude: { not: null },
        longitude: { not: null },
      },
      include: { bankAccount: true },
      orderBy: { id: 'asc' },
    });

    if (availableBranch) {
      return availableBranch;
    }

    const defaultBranch = await this.getOrCreateDefaultBranch();
    return { ...defaultBranch, bankAccount: null };
  }

  private serialize(settings: Awaited<ReturnType<typeof this.getOrCreate>>) {
    return {
      ...settings,
      maxDeliveryDistanceKm: Number(settings.maxDeliveryDistanceKm),
      deliveryBaseDistanceKm: Number(settings.deliveryBaseDistanceKm),
      timeZone: STORE_TIME_ZONE,
    };
  }

  private serializeBranch(
    branch: Awaited<ReturnType<typeof this.getOrCreateDefaultBranch>>,
    bankTransferAvailable = false,
  ) {
    return {
      id: branch.id,
      code: branch.code,
      name: branch.name,
      address: branch.address,
      phone: branch.phone,
      latitude: branch.latitude === null ? null : Number(branch.latitude),
      longitude: branch.longitude === null ? null : Number(branch.longitude),
      openedAt: branch.openedAt ?? null,
      staffCount: 0,
      activeStaffCount: 0,
      isActive: branch.isActive,
      isAcceptingOrders: branch.isAcceptingOrders,
      bankTransferAvailable,
      pauseReason: branch.pauseReason,
      createdAt: branch.createdAt,
      updatedAt: branch.updatedAt,
    };
  }

  private assertCompleteCoordinates(
    latitude: number | null | undefined,
    longitude: number | null | undefined,
  ) {
    const hasLatitude = latitude !== null && latitude !== undefined;
    const hasLongitude = longitude !== null && longitude !== undefined;

    if (hasLatitude !== hasLongitude) {
      throw new BadRequestException(
        'Vui lòng nhập đầy đủ cả vĩ độ và kinh độ của chi nhánh',
      );
    }
  }

  private async getBranchById(id: number) {
    const branch = await this.prisma.storeBranch.findUnique({
      where: { id },
    });

    if (!branch) {
      throw new NotFoundException('Không tìm thấy chi nhánh');
    }

    return branch;
  }

  async getSettings() {
    const settings = await this.getOrCreate();

    return this.serialize(settings);
  }

  // Danh sách điểm bán công khai lấy trực tiếp từ chi nhánh đang hoạt động.
  async getLocations() {
    await this.getOrCreateDefaultBranch();

    const [settings, branches] = await Promise.all([
      this.getOrCreate(),
      this.prisma.storeBranch.findMany({
        where: { isActive: true },
        include: { bankAccount: true },
        orderBy: [{ code: 'asc' }, { id: 'asc' }],
      }),
    ]);
    const withinOpeningHours = this.isWithinOpeningHours(
      settings.openingTime,
      settings.closingTime,
    );

    return branches.map((branch) => {
      const branchAccepting =
        settings.isAcceptingOrders && branch.isAcceptingOrders;
      const locationReady = Boolean(
        branch.address && branch.latitude !== null && branch.longitude !== null,
      );
      const isOpen = withinOpeningHours && branchAccepting && locationReady;
      let unavailableReason: string | null = null;

      if (!settings.isAcceptingOrders) {
        unavailableReason =
          settings.pauseReason?.trim() || 'Hệ thống đang tạm ngưng hoạt động.';
      } else if (!withinOpeningHours) {
        unavailableReason = `Ngoài giờ phục vụ ${settings.openingTime} - ${settings.closingTime}.`;
      } else if (!branch.isAcceptingOrders) {
        unavailableReason =
          branch.pauseReason?.trim() || 'Chi nhánh đang tạm ngưng nhận đơn.';
      } else if (!locationReady) {
        unavailableReason =
          'Chi nhánh chưa cấu hình đầy đủ địa chỉ và tọa độ nhận đơn.';
      }

      return {
        id: branch.id,
        code: branch.code,
        name: branch.name,
        address: branch.address,
        phone: branch.phone,
        latitude: branch.latitude === null ? null : Number(branch.latitude),
        longitude: branch.longitude === null ? null : Number(branch.longitude),
        isOpen,
        isAcceptingOrders: branchAccepting,
        openingTime: settings.openingTime,
        closingTime: settings.closingTime,
        preparationMinutes: settings.preparationMinutes,
        deliveryAvailable: isOpen && settings.deliveryEnabled,
        pickupAvailable: isOpen && settings.pickupEnabled,
        bankTransferAvailable: Boolean(branch.bankAccount?.isActive),
        unavailableReason,
        timeZone: STORE_TIME_ZONE,
      };
    });
  }

  // Admin xem toàn bộ chi nhánh để chuẩn bị cho luồng quản lý nhiều chi nhánh.
  async getBranches() {
    await this.getOrCreateDefaultBranch();

    const branches = await this.prisma.storeBranch.findMany({
      include: {
        manager: {
          select: {
            id: true,
            email: true,
            ...personProfileSelect,
            isActive: true,
          },
        },
        staff: {
          where: {
            user: { role: { name: { in: ['STAFF', 'BRANCH_MANAGER'] } } },
          },
          select: { user: { select: { isActive: true } } },
        },
      },

      orderBy: {
        id: 'asc',
      },
    });

    return branches.map((branch) => ({
      ...this.serializeBranch(branch),

      manager: branch.manager ? flattenPersonProfile(branch.manager) : null,
      staffCount: branch.staff.length,
      activeStaffCount: branch.staff.filter((staff) => staff.user.isActive)
        .length,
    }));
  }

  async createBranch(createBranchDto: CreateBranchDto) {
    this.assertCompleteCoordinates(
      createBranchDto.latitude,
      createBranchDto.longitude,
    );

    const existing = await this.prisma.storeBranch.findUnique({
      where: { code: createBranchDto.code },
    });

    if (existing) {
      throw new ConflictException('Mã chi nhánh đã tồn tại');
    }

    const branch = await this.prisma.storeBranch.create({
      data: {
        code: createBranchDto.code,
        name: createBranchDto.name,
        address: createBranchDto.address ?? null,
        phone: createBranchDto.phone ?? null,
        latitude: createBranchDto.latitude ?? null,
        longitude: createBranchDto.longitude ?? null,
        openedAt: createBranchDto.openedAt
          ? new Date(createBranchDto.openedAt)
          : null,
      },
    });

    return this.serializeBranch(branch);
  }

  async updateBranch(id: number, updateBranchDto: UpdateBranchDto) {
    await this.getBranchById(id);
    const coordinatesWereUpdated =
      updateBranchDto.latitude !== undefined ||
      updateBranchDto.longitude !== undefined;

    if (coordinatesWereUpdated) {
      this.assertCompleteCoordinates(
        updateBranchDto.latitude,
        updateBranchDto.longitude,
      );
    }

    const branch = await this.prisma.storeBranch.update({
      where: { id },
      data: {
        ...(updateBranchDto.name !== undefined
          ? { name: updateBranchDto.name }
          : {}),
        ...(updateBranchDto.address !== undefined
          ? { address: updateBranchDto.address }
          : {}),
        ...(updateBranchDto.phone !== undefined
          ? { phone: updateBranchDto.phone }
          : {}),
        ...(updateBranchDto.latitude !== undefined
          ? { latitude: updateBranchDto.latitude }
          : {}),
        ...(updateBranchDto.longitude !== undefined
          ? { longitude: updateBranchDto.longitude }
          : {}),
        ...(updateBranchDto.openedAt !== undefined
          ? {
              openedAt: updateBranchDto.openedAt
                ? new Date(updateBranchDto.openedAt)
                : null,
            }
          : {}),
      },
    });

    return this.serializeBranch(branch);
  }

  async updateBranchActive(id: number, isActive: boolean) {
    const current = await this.getBranchById(id);

    if (current.code === DEFAULT_BRANCH_CODE && !isActive) {
      const otherActiveCount = await this.prisma.storeBranch.count({
        where: {
          isActive: true,
          NOT: { id },
        },
      });

      if (otherActiveCount === 0) {
        throw new BadRequestException(
          'Không thể khóa chi nhánh chính khi chưa có chi nhánh khác đang hoạt động',
        );
      }
    }

    const branch = await this.prisma.storeBranch.update({
      where: { id },
      data: { isActive },
    });

    return this.serializeBranch(branch);
  }

  // Staff vận hành trạng thái nhận đơn của chi nhánh hiện tại, không đóng hệ thống.
  private async getStaffBranch(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        staffProfile: {
          select: { branch: { include: { bankAccount: true } } },
        },
      },
    });

    if (!user?.staffProfile?.branch) {
      throw new NotFoundException('Nhân viên chưa được gán chi nhánh');
    }

    return user.staffProfile.branch;
  }

  async getBranchStatus(userId: number) {
    const branch = await this.getStaffBranch(userId);

    return this.serializeBranch(branch, Boolean(branch.bankAccount?.isActive));
  }

  async updateBranchStatus(
    userId: number,
    updateAcceptingOrdersDto: UpdateAcceptingOrdersDto,
  ) {
    const current = await this.getStaffBranch(userId);

    if (!current.isActive) {
      throw new BadRequestException(
        'Chi nhánh đã bị Admin khóa, nhân viên không thể đổi trạng thái nhận đơn',
      );
    }

    const branch = await this.prisma.storeBranch.update({
      where: { id: current.id },
      data: {
        isAcceptingOrders: updateAcceptingOrdersDto.isAcceptingOrders,
        pauseReason: updateAcceptingOrdersDto.isAcceptingOrders
          ? null
          : updateAcceptingOrdersDto.pauseReason?.trim() ||
            'Chi nhánh đang tạm ngưng nhận đơn.',
      },
      include: { bankAccount: true },
    });

    return this.serializeBranch(branch, Boolean(branch.bankAccount?.isActive));
  }

  async getStatus(branchId?: number) {
    const [settings, branch] = await Promise.all([
      this.getOrCreate(),
      this.resolveOrderBranch(branchId),
    ]);

    if (!branch) {
      throw new NotFoundException('Không tìm thấy chi nhánh nhận đơn');
    }

    const withinOpeningHours = this.isWithinOpeningHours(
      settings.openingTime,
      settings.closingTime,
    );
    const isSystemActive = settings.isAcceptingOrders;
    const isBranchAcceptingOrders = branch.isActive && branch.isAcceptingOrders;
    const isAcceptingOrders = isSystemActive && isBranchAcceptingOrders;
    const locationReady = Boolean(
      branch.address && branch.latitude !== null && branch.longitude !== null,
    );
    const acceptingOrders =
      withinOpeningHours && isAcceptingOrders && locationReady;

    let unavailableReason: string | null = null;
    let unavailableScope: 'SYSTEM' | 'BRANCH' | 'HOURS' | 'FULFILLMENT' | null =
      null;

    if (!isSystemActive) {
      unavailableScope = 'SYSTEM';
      unavailableReason =
        settings.pauseReason?.trim() || 'Hệ thống đang tạm ngưng hoạt động.';
    } else if (!withinOpeningHours) {
      unavailableScope = 'HOURS';
      unavailableReason = `Cửa hàng hiện đã đóng cửa. Giờ phục vụ: ${settings.openingTime} - ${settings.closingTime}.`;
    } else if (!isBranchAcceptingOrders) {
      unavailableScope = 'BRANCH';
      unavailableReason =
        branch.pauseReason?.trim() || 'Chi nhánh đang tạm ngưng nhận đơn.';
    } else if (!locationReady) {
      unavailableScope = 'FULFILLMENT';
      unavailableReason =
        'Chi nhánh chưa cấu hình đầy đủ địa chỉ và tọa độ nhận đơn.';
    } else if (!settings.deliveryEnabled && !settings.pickupEnabled) {
      unavailableScope = 'FULFILLMENT';
      unavailableReason = 'Cửa hàng chưa mở phương thức nhận hàng.';
    }

    return {
      isOpen: acceptingOrders,
      isWithinOpeningHours: withinOpeningHours,
      isAcceptingOrders,
      isSystemActive,
      isBranchAcceptingOrders,
      branch: {
        id: branch.id,
        code: branch.code,
        name: branch.name,
        address: branch.address,
        phone: branch.phone,
        latitude: branch.latitude === null ? null : Number(branch.latitude),
        longitude: branch.longitude === null ? null : Number(branch.longitude),
      },
      deliveryAvailable: acceptingOrders && settings.deliveryEnabled,
      pickupAvailable: acceptingOrders && settings.pickupEnabled,
      bankTransferAvailable: Boolean(branch.bankAccount?.isActive),
      openingTime: settings.openingTime,
      closingTime: settings.closingTime,
      preparationMinutes: settings.preparationMinutes,
      maxDeliveryDistanceKm: Number(settings.maxDeliveryDistanceKm),
      deliveryBaseDistanceKm: Number(settings.deliveryBaseDistanceKm),
      deliveryBaseFee: settings.deliveryBaseFee,
      deliveryFeePerKm: settings.deliveryFeePerKm,
      deliveryDiscountFirstThreshold: settings.deliveryDiscountFirstThreshold,
      deliveryDiscountFirstAmount: settings.deliveryDiscountFirstAmount,
      deliveryDiscountSecondThreshold: settings.deliveryDiscountSecondThreshold,
      deliveryDiscountSecondAmount: settings.deliveryDiscountSecondAmount,
      unavailableReason,
      unavailableScope,
      timeZone: STORE_TIME_ZONE,
    };
  }

  async calculateDeliveryPricing(distanceKm: number, subtotal: number) {
    const settings = await this.getOrCreate();
    const baseDistanceKm = Number(settings.deliveryBaseDistanceKm);
    const deliveryBaseFee =
      settings.deliveryBaseFee +
      Math.max(0, Math.ceil(distanceKm - baseDistanceKm)) *
        settings.deliveryFeePerKm;
    const requestedDiscount =
      subtotal >= settings.deliveryDiscountSecondThreshold
        ? settings.deliveryDiscountSecondAmount
        : subtotal >= settings.deliveryDiscountFirstThreshold
          ? settings.deliveryDiscountFirstAmount
          : 0;
    const deliveryDiscountAmount = Math.min(requestedDiscount, deliveryBaseFee);

    return {
      deliveryBaseFee,
      deliveryDiscountAmount,
      deliveryFee: deliveryBaseFee - deliveryDiscountAmount,
    };
  }

  async update(updateStoreSettingsDto: UpdateStoreSettingsDto) {
    const current = await this.getOrCreate();

    const deliveryEnabled =
      updateStoreSettingsDto.deliveryEnabled ?? current.deliveryEnabled;
    const pickupEnabled =
      updateStoreSettingsDto.pickupEnabled ?? current.pickupEnabled;

    if (!deliveryEnabled && !pickupEnabled) {
      throw new BadRequestException(
        'Phải bật ít nhất một phương thức nhận hàng',
      );
    }

    const maxDeliveryDistanceKm = Number(
      updateStoreSettingsDto.maxDeliveryDistanceKm ??
        current.maxDeliveryDistanceKm,
    );
    const deliveryBaseDistanceKm = Number(
      updateStoreSettingsDto.deliveryBaseDistanceKm ??
        current.deliveryBaseDistanceKm,
    );
    const firstThreshold =
      updateStoreSettingsDto.deliveryDiscountFirstThreshold ??
      current.deliveryDiscountFirstThreshold;
    const secondThreshold =
      updateStoreSettingsDto.deliveryDiscountSecondThreshold ??
      current.deliveryDiscountSecondThreshold;
    const firstAmount =
      updateStoreSettingsDto.deliveryDiscountFirstAmount ??
      current.deliveryDiscountFirstAmount;
    const secondAmount =
      updateStoreSettingsDto.deliveryDiscountSecondAmount ??
      current.deliveryDiscountSecondAmount;

    if (deliveryBaseDistanceKm > maxDeliveryDistanceKm) {
      throw new BadRequestException(
        'Quãng đường tính phí cơ bản không được lớn hơn bán kính giao hàng tối đa',
      );
    }

    if (secondThreshold <= firstThreshold) {
      throw new BadRequestException(
        'Mốc ưu đãi thứ hai phải lớn hơn mốc ưu đãi thứ nhất',
      );
    }

    if (secondAmount < firstAmount) {
      throw new BadRequestException(
        'Mức giảm thứ hai không được thấp hơn mức giảm thứ nhất',
      );
    }

    const pauseReason =
      updateStoreSettingsDto.isAcceptingOrders === true
        ? null
        : updateStoreSettingsDto.pauseReason === undefined
          ? current.pauseReason
          : updateStoreSettingsDto.pauseReason?.trim() || null;

    const settings = await this.prisma.storeSettings.update({
      where: { id: STORE_SETTINGS_ID },
      data: {
        ...updateStoreSettingsDto,
        pauseReason,
      },
    });

    return this.serialize(settings);
  }

  // Endpoint nhanh dành riêng cho Admin đóng/mở toàn hệ thống.
  async updateAcceptingOrders(
    updateAcceptingOrdersDto: UpdateAcceptingOrdersDto,
  ) {
    await this.getOrCreate();

    const settings = await this.prisma.storeSettings.update({
      where: { id: STORE_SETTINGS_ID },
      data: {
        isAcceptingOrders: updateAcceptingOrdersDto.isAcceptingOrders,
        pauseReason: updateAcceptingOrdersDto.isAcceptingOrders
          ? null
          : updateAcceptingOrdersDto.pauseReason?.trim() ||
            'Hệ thống đang tạm ngưng hoạt động.',
      },
    });

    return this.serialize(settings);
  }

  async assertCanCheckout(
    fulfillmentMethod: 'DELIVERY' | 'PICKUP',
    deliveryDistanceKm?: number,
    branchId?: number,
    paymentMethod?: 'COD' | 'BANK_TRANSFER',
  ) {
    const status = await this.getStatus(branchId);

    if (!status.isOpen) {
      throw new BadRequestException(
        status.unavailableReason || 'Cửa hàng hiện chưa nhận đơn',
      );
    }

    if (fulfillmentMethod === 'DELIVERY' && !status.deliveryAvailable) {
      throw new BadRequestException('Cửa hàng đang tạm ngưng giao hàng');
    }

    if (fulfillmentMethod === 'PICKUP' && !status.pickupAvailable) {
      throw new BadRequestException(
        'Cửa hàng đang tạm ngưng nhận đơn tại quán',
      );
    }

    if (paymentMethod === 'BANK_TRANSFER' && !status.bankTransferAvailable) {
      throw new BadRequestException(
        'Chi nhánh chưa cấu hình tài khoản nhận chuyển khoản',
      );
    }

    if (
      fulfillmentMethod === 'DELIVERY' &&
      deliveryDistanceKm !== undefined &&
      deliveryDistanceKm > status.maxDeliveryDistanceKm
    ) {
      throw new BadRequestException(
        `Địa chỉ nằm ngoài bán kính giao hàng tối đa ${status.maxDeliveryDistanceKm} km`,
      );
    }

    return status;
  }

  // Admin thăng một Staff trong chi nhánh thành trưởng chi nhánh.
  async assignBranchManager(branchId: number, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const branch = await tx.storeBranch.findUnique({
        where: {
          id: branchId,
        },

        include: {
          manager: true,
        },
      });

      if (!branch) {
        throw new NotFoundException('Không tìm thấy chi nhánh');
      }

      if (!branch.isActive) {
        throw new BadRequestException(
          'Không thể gán trưởng cho chi nhánh đã bị khóa',
        );
      }

      const user = await tx.user.findUnique({
        where: {
          id: userId,
        },

        include: {
          role: true,
          staffProfile: { select: { branchId: true } },
        },
      });

      if (!user) {
        throw new NotFoundException('Không tìm thấy nhân viên');
      }

      if (!user.isActive) {
        throw new BadRequestException(
          'Không thể thăng chức tài khoản đã bị khóa',
        );
      }

      if (user.staffProfile?.branchId !== branchId) {
        throw new BadRequestException('Nhân viên không thuộc chi nhánh này');
      }

      if (user.role.name !== 'STAFF' && user.role.name !== 'BRANCH_MANAGER') {
        throw new BadRequestException('Chỉ có thể thăng chức từ nhân viên');
      }

      const existingManagedBranch = await tx.storeBranch.findFirst({
        where: {
          managerId: userId,

          id: {
            not: branchId,
          },
        },
      });

      if (existingManagedBranch) {
        throw new ConflictException(
          'Nhân viên này đang quản lý một chi nhánh khác',
        );
      }

      const [managerRole, staffRole] = await Promise.all([
        tx.role.findUnique({
          where: {
            name: 'BRANCH_MANAGER',
          },
        }),

        tx.role.findUnique({
          where: {
            name: 'STAFF',
          },
        }),
      ]);

      if (!managerRole || !staffRole) {
        throw new NotFoundException('Thiếu Role STAFF hoặc BRANCH_MANAGER');
      }

      // Nếu chi nhánh đã có trưởng khác thì hạ người cũ về STAFF.
      if (branch.managerId && branch.managerId !== userId) {
        await tx.user.update({
          where: {
            id: branch.managerId,
          },

          data: {
            roleId: staffRole.id,
          },
        });
      }

      await tx.user.update({
        where: {
          id: userId,
        },

        data: {
          roleId: managerRole.id,
          staffProfile: {
            upsert: {
              create: { branchId },
              update: { branchId },
            },
          },
        },
      });

      const updatedBranch = await tx.storeBranch.update({
        where: {
          id: branchId,
        },

        data: {
          managerId: userId,
        },

        include: {
          manager: {
            select: {
              id: true,
              email: true,
              ...personProfileSelect,
              isActive: true,
            },
          },
        },
      });

      return {
        ...this.serializeBranch(updatedBranch),

        manager: updatedBranch.manager
          ? flattenPersonProfile(updatedBranch.manager)
          : null,
      };
    });
  }

  // Admin hạ trưởng chi nhánh về Staff.
  async removeBranchManager(branchId: number) {
    return this.prisma.$transaction(async (tx) => {
      const branch = await tx.storeBranch.findUnique({
        where: {
          id: branchId,
        },
      });

      if (!branch) {
        throw new NotFoundException('Không tìm thấy chi nhánh');
      }

      if (!branch.managerId) {
        return this.serializeBranch(branch);
      }

      const staffRole = await tx.role.findUnique({
        where: {
          name: 'STAFF',
        },
      });

      if (!staffRole) {
        throw new NotFoundException('Không tìm thấy Role STAFF');
      }

      // Gỡ quan hệ trước để tránh trạng thái trưởng bị giữ lại.
      await tx.storeBranch.update({
        where: {
          id: branchId,
        },

        data: {
          managerId: null,
        },
      });

      await tx.user.update({
        where: {
          id: branch.managerId,
        },

        data: {
          roleId: staffRole.id,
        },
      });

      const updatedBranch = await tx.storeBranch.findUniqueOrThrow({
        where: {
          id: branchId,
        },
      });

      return this.serializeBranch(updatedBranch);
    });
  }
}
