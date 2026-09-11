import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  // Trả toàn bộ địa chỉ của user, địa chỉ mặc định luôn đứng đầu.
  findMine(userId: number) {
    return this.prisma.userAddress.findMany({
      where: {
        userId,
      },

      orderBy: [
        {
          isDefault: 'desc',
        },
        {
          updatedAt: 'desc',
        },
      ],
    });
  }

  // Một tài khoản được lưu tối đa 10 địa chỉ.
  // Địa chỉ đầu tiên luôn trở thành địa chỉ mặc định.
  async create(userId: number, dto: CreateAddressDto) {
    return this.prisma.$transaction(async (tx) => {
      const addressCount = await tx.userAddress.count({
        where: {
          userId,
        },
      });

      if (addressCount >= 10) {
        throw new BadRequestException(
          'Mỗi tài khoản chỉ được lưu tối đa 10 địa chỉ',
        );
      }

      const shouldBeDefault = addressCount === 0 || dto.isDefault === true;

      if (shouldBeDefault) {
        await tx.userAddress.updateMany({
          where: {
            userId,
            isDefault: true,
          },

          data: {
            isDefault: false,
          },
        });
      }

      return tx.userAddress.create({
        data: {
          userId,

          label: dto.label.trim(),

          receiverName: dto.receiverName.trim(),

          receiverPhone: dto.receiverPhone.trim(),

          addressLine: dto.addressLine.trim(),

          latitude: dto.latitude,

          longitude: dto.longitude,

          isDefault: shouldBeDefault,
        },
      });
    });
  }

  // Chỉ cho phép user sửa địa chỉ thuộc chính tài khoản của mình.
  async update(userId: number, addressId: number, dto: UpdateAddressDto) {
    const address = await this.prisma.userAddress.findFirst({
      where: {
        id: addressId,
        userId,
      },

      select: {
        id: true,
      },
    });

    if (!address) {
      throw new NotFoundException('Không tìm thấy địa chỉ');
    }

    return this.prisma.userAddress.update({
      where: {
        id: addressId,
      },

      data: {
        ...(dto.label !== undefined
          ? {
              label: dto.label.trim(),
            }
          : {}),

        ...(dto.receiverName !== undefined
          ? {
              receiverName: dto.receiverName.trim(),
            }
          : {}),

        ...(dto.receiverPhone !== undefined
          ? {
              receiverPhone: dto.receiverPhone.trim(),
            }
          : {}),

        ...(dto.addressLine !== undefined
          ? {
              addressLine: dto.addressLine.trim(),
            }
          : {}),

        ...(dto.latitude !== undefined
          ? {
              latitude: dto.latitude,
            }
          : {}),

        ...(dto.longitude !== undefined
          ? {
              longitude: dto.longitude,
            }
          : {}),
      },
    });
  }

  // Đặt một địa chỉ làm mặc định và bỏ mặc định ở các địa chỉ còn lại.
  async setDefault(userId: number, addressId: number) {
    return this.prisma.$transaction(async (tx) => {
      const address = await tx.userAddress.findFirst({
        where: {
          id: addressId,
          userId,
        },
      });

      if (!address) {
        throw new NotFoundException('Không tìm thấy địa chỉ');
      }

      await tx.userAddress.updateMany({
        where: {
          userId,
          isDefault: true,
        },

        data: {
          isDefault: false,
        },
      });

      return tx.userAddress.update({
        where: {
          id: address.id,
        },

        data: {
          isDefault: true,
        },
      });
    });
  }

  // Nếu xóa địa chỉ mặc định, tự chọn địa chỉ mới cập nhật gần nhất.
  async remove(userId: number, addressId: number) {
    return this.prisma.$transaction(async (tx) => {
      const address = await tx.userAddress.findFirst({
        where: {
          id: addressId,
          userId,
        },
      });

      if (!address) {
        throw new NotFoundException('Không tìm thấy địa chỉ');
      }

      await tx.userAddress.delete({
        where: {
          id: address.id,
        },
      });

      if (address.isDefault) {
        const replacement = await tx.userAddress.findFirst({
          where: {
            userId,
          },

          orderBy: {
            updatedAt: 'desc',
          },

          select: {
            id: true,
          },
        });

        if (replacement) {
          await tx.userAddress.update({
            where: {
              id: replacement.id,
            },

            data: {
              isDefault: true,
            },
          });
        }
      }

      return {
        message: 'Đã xóa địa chỉ',
      };
    });
  }
}
