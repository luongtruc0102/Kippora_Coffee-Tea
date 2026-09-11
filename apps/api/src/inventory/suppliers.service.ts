import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(q?: string, status?: string) {
    const keyword = q?.trim();
    return this.prisma.supplier.findMany({
      where: {
        ...(status === 'ACTIVE'
          ? { isActive: true }
          : status === 'INACTIVE'
            ? { isActive: false }
            : {}),
        ...(keyword
          ? {
              OR: [
                { code: { contains: keyword, mode: 'insensitive' as const } },
                { name: { contains: keyword, mode: 'insensitive' as const } },
                {
                  contactName: {
                    contains: keyword,
                    mode: 'insensitive' as const,
                  },
                },
                { phone: { contains: keyword } },
              ],
            }
          : {}),
      },
      include: {
        _count: { select: { stockReceipts: true } },
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async create(dto: CreateSupplierDto) {
    const code = dto.code.trim().toUpperCase();
    await this.assertCodeAvailable(code);
    return this.prisma.supplier.create({
      data: {
        code,
        name: dto.name.trim(),
        contactName: dto.contactName?.trim() || null,
        phone: dto.phone?.trim() || null,
        email: dto.email?.trim().toLowerCase() || null,
        address: dto.address?.trim() || null,
        note: dto.note?.trim() || null,
      },
      include: { _count: { select: { stockReceipts: true } } },
    });
  }

  async update(id: number, dto: UpdateSupplierDto) {
    const current = await this.prisma.supplier.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Không tìm thấy nhà cung cấp');
    const code = dto.code?.trim().toUpperCase();
    if (code && code !== current.code) await this.assertCodeAvailable(code, id);
    return this.prisma.supplier.update({
      where: { id },
      data: {
        ...(code ? { code } : {}),
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.contactName !== undefined
          ? { contactName: dto.contactName.trim() || null }
          : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone.trim() || null } : {}),
        ...(dto.email !== undefined
          ? { email: dto.email.trim().toLowerCase() || null }
          : {}),
        ...(dto.address !== undefined
          ? { address: dto.address.trim() || null }
          : {}),
        ...(dto.note !== undefined ? { note: dto.note.trim() || null } : {}),
      },
      include: { _count: { select: { stockReceipts: true } } },
    });
  }

  async updateStatus(id: number, isActive: boolean) {
    const current = await this.prisma.supplier.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Không tìm thấy nhà cung cấp');
    return this.prisma.supplier.update({
      where: { id },
      data: { isActive },
      include: { _count: { select: { stockReceipts: true } } },
    });
  }

  private async assertCodeAvailable(code: string, ignoredId?: number) {
    const exists = await this.prisma.supplier.findFirst({
      where: {
        code: { equals: code, mode: 'insensitive' },
        ...(ignoredId ? { id: { not: ignoredId } } : {}),
      },
    });
    if (exists) throw new ConflictException('Mã nhà cung cấp đã tồn tại');
  }
}
