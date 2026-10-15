import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { writeAuditLog } from '../common/audit-logs/audit-log.util';
import { PrismaService } from '../prisma/prisma.service';
import type { BannerTargetType } from './banner.constants';
import { CreateBannerDto } from './dto/create-banner.dto';
import { ListBannersDto } from './dto/list-banners.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';

type TargetInput = {
  targetType: string;
  productId?: number | null;
  voucherId?: number | null;
  contentPageId?: number | null;
  customUrl?: string | null;
};

@Injectable()
export class BannersService {
  constructor(private readonly prisma: PrismaService) {}

  private async findOne(id: number) {
    const banner = await this.prisma.homepageBanner.findUnique({
      where: { id },
    });
    if (!banner) throw new NotFoundException('Không tìm thấy banner');
    return banner;
  }

  private validateSchedule(startsAt?: string | null, endsAt?: string | null) {
    const start = startsAt ? new Date(startsAt) : null;
    const end = endsAt ? new Date(endsAt) : null;
    if (start && end && end <= start) {
      throw new BadRequestException(
        'Thời gian kết thúc phải sau thời gian bắt đầu',
      );
    }
    return { startsAt: start, endsAt: end };
  }

  private async validateBranch(branchId?: number | null) {
    if (!branchId) return;
    const branch = await this.prisma.storeBranch.findUnique({
      where: { id: branchId },
      select: { id: true },
    });
    if (!branch) throw new BadRequestException('Chi nhánh không tồn tại');
  }

  private async buildTargetData(input: TargetInput) {
    const targetType = input.targetType as BannerTargetType;
    const data = {
      targetType,
      productId: null as number | null,
      voucherId: null as number | null,
      contentPageId: null as number | null,
      customUrl: null as string | null,
    };

    if (targetType === 'PRODUCT') {
      if (!input.productId) throw new BadRequestException('Hãy chọn sản phẩm');
      const product = await this.prisma.product.findUnique({
        where: { id: input.productId },
        select: { id: true },
      });
      if (!product) throw new BadRequestException('Sản phẩm không tồn tại');
      data.productId = input.productId;
    } else if (targetType === 'VOUCHER') {
      if (!input.voucherId) throw new BadRequestException('Hãy chọn voucher');
      const voucher = await this.prisma.voucher.findUnique({
        where: { id: input.voucherId },
        select: { id: true },
      });
      if (!voucher) throw new BadRequestException('Voucher không tồn tại');
      data.voucherId = input.voucherId;
    } else if (targetType === 'CONTENT_PAGE') {
      if (!input.contentPageId) {
        throw new BadRequestException('Hãy chọn trang nội dung');
      }
      const contentPage = await this.prisma.contentPage.findUnique({
        where: { id: input.contentPageId },
        select: { id: true },
      });
      if (!contentPage) {
        throw new BadRequestException('Trang nội dung không tồn tại');
      }
      data.contentPageId = input.contentPageId;
    } else if (targetType === 'CUSTOM_URL') {
      if (!input.customUrl?.trim()) {
        throw new BadRequestException('Hãy nhập đường dẫn tùy chỉnh');
      }
      data.customUrl = input.customUrl.trim();
    }

    return data;
  }

  private buildHref(banner: {
    targetType: string;
    customUrl: string | null;
    product: { id: number; isActive: boolean } | null;
    voucher: { code: string; isActive: boolean } | null;
    contentPage: { slug: string; isPublished: boolean } | null;
  }) {
    if (banner.targetType === 'MENU') return '/menu';
    if (banner.targetType === 'PRODUCT' && banner.product?.isActive) {
      return `/menu?productId=${banner.product.id}`;
    }
    if (banner.targetType === 'VOUCHER' && banner.voucher?.isActive) {
      return `/menu?voucher=${encodeURIComponent(banner.voucher.code)}`;
    }
    if (
      banner.targetType === 'CONTENT_PAGE' &&
      banner.contentPage?.isPublished
    ) {
      return `/thong-tin/${banner.contentPage.slug}`;
    }
    if (banner.targetType === 'CUSTOM_URL') return banner.customUrl;
    return null;
  }

  async findPublic(branchId?: number) {
    const now = new Date();
    const banners = await this.prisma.homepageBanner.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
          branchId
            ? { OR: [{ branchId: null }, { branchId }] }
            : { branchId: null },
        ],
      },
      include: {
        product: { select: { id: true, name: true, isActive: true } },
        voucher: { select: { id: true, code: true, isActive: true } },
        contentPage: {
          select: { id: true, slug: true, title: true, isPublished: true },
        },
        branch: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    return banners.map((banner) => ({
      id: banner.id,
      eyebrow: banner.eyebrow,
      title: banner.title,
      subtitle: banner.subtitle,
      buttonLabel: banner.buttonLabel,
      imageUrl: banner.imageUrl,
      theme: banner.theme,
      startsAt: banner.startsAt,
      endsAt: banner.endsAt,
      sortOrder: banner.sortOrder,
      branch: banner.branch,
      href: this.buildHref(banner),
    }));
  }

  async findAllForAdmin(query: ListBannersDto) {
    const search = query.q?.trim();
    return this.prisma.homepageBanner.findMany({
      where: {
        ...(query.branchId ? { branchId: query.branchId } : {}),
        ...(query.status === 'ACTIVE'
          ? { isActive: true }
          : query.status === 'INACTIVE'
            ? { isActive: false }
            : {}),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: 'insensitive' } },
                { subtitle: { contains: search, mode: 'insensitive' } },
                { eyebrow: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        product: { select: { id: true, name: true, isActive: true } },
        voucher: { select: { id: true, code: true, isActive: true } },
        contentPage: {
          select: { id: true, slug: true, title: true, isPublished: true },
        },
        branch: { select: { id: true, code: true, name: true } },
        updatedBy: {
          select: {
            email: true,
            profile: { select: { fullName: true } },
          },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async create(actorId: number, dto: CreateBannerDto) {
    await this.validateBranch(dto.branchId);
    const schedule = this.validateSchedule(dto.startsAt, dto.endsAt);
    const target = await this.buildTargetData(dto);
    const banner = await this.prisma.homepageBanner.create({
      data: {
        eyebrow: dto.eyebrow?.trim() || null,
        title: dto.title.trim(),
        subtitle: dto.subtitle?.trim() || null,
        buttonLabel: dto.buttonLabel?.trim() || null,
        imageUrl: dto.imageUrl?.trim() || null,
        theme: dto.theme,
        ...target,
        branchId: dto.branchId ?? null,
        ...schedule,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
        updatedById: actorId,
      },
    });
    await writeAuditLog(this.prisma, {
      actorId,
      branchId: banner.branchId,
      module: 'CONTENT',
      action: 'CREATE_BANNER',
      entityType: 'HomepageBanner',
      entityId: banner.id,
      description: `Tạo banner “${banner.title}”`,
      afterData: banner,
    });
    return banner;
  }

  async update(actorId: number, id: number, dto: UpdateBannerDto) {
    const before = await this.findOne(id);
    const branchId =
      dto.branchId !== undefined ? dto.branchId : before.branchId;
    await this.validateBranch(branchId);
    const startsAt =
      dto.startsAt !== undefined
        ? dto.startsAt
        : before.startsAt?.toISOString();
    const endsAt =
      dto.endsAt !== undefined ? dto.endsAt : before.endsAt?.toISOString();
    const schedule = this.validateSchedule(startsAt, endsAt);
    const target = await this.buildTargetData({
      targetType: dto.targetType ?? before.targetType,
      productId: dto.productId !== undefined ? dto.productId : before.productId,
      voucherId: dto.voucherId !== undefined ? dto.voucherId : before.voucherId,
      contentPageId:
        dto.contentPageId !== undefined
          ? dto.contentPageId
          : before.contentPageId,
      customUrl: dto.customUrl !== undefined ? dto.customUrl : before.customUrl,
    });

    const banner = await this.prisma.homepageBanner.update({
      where: { id },
      data: {
        ...(dto.eyebrow !== undefined
          ? { eyebrow: dto.eyebrow.trim() || null }
          : {}),
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.subtitle !== undefined
          ? { subtitle: dto.subtitle.trim() || null }
          : {}),
        ...(dto.buttonLabel !== undefined
          ? { buttonLabel: dto.buttonLabel.trim() || null }
          : {}),
        ...(dto.imageUrl !== undefined
          ? { imageUrl: dto.imageUrl.trim() || null }
          : {}),
        ...(dto.theme !== undefined ? { theme: dto.theme } : {}),
        ...target,
        branchId,
        ...schedule,
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        updatedById: actorId,
      },
    });
    await writeAuditLog(this.prisma, {
      actorId,
      branchId: banner.branchId,
      module: 'CONTENT',
      action: 'UPDATE_BANNER',
      entityType: 'HomepageBanner',
      entityId: banner.id,
      description: `Cập nhật banner “${banner.title}”`,
      beforeData: before,
      afterData: banner,
    });
    return banner;
  }

  async updateStatus(actorId: number, id: number, isActive: boolean) {
    const before = await this.findOne(id);
    const banner = await this.prisma.homepageBanner.update({
      where: { id },
      data: { isActive, updatedById: actorId },
    });
    await writeAuditLog(this.prisma, {
      actorId,
      branchId: banner.branchId,
      module: 'CONTENT',
      action: isActive ? 'ACTIVATE_BANNER' : 'DEACTIVATE_BANNER',
      entityType: 'HomepageBanner',
      entityId: banner.id,
      description: `${isActive ? 'Bật' : 'Tắt'} banner “${banner.title}”`,
      beforeData: before,
      afterData: banner,
    });
    return banner;
  }
}
