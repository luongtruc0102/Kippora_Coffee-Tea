import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { writeAuditLog } from '../common/audit-logs/audit-log.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContentPageDto } from './dto/create-content-page.dto';
import { ListContentPagesDto } from './dto/list-content-pages.dto';
import { UpdateContentPageDto } from './dto/update-content-page.dto';

const publicSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  content: true,
  category: true,
  showInHeader: true,
  showInFooter: true,
  sortOrder: true,
  updatedAt: true,
} as const;

@Injectable()
export class ContentPagesService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeSlug(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120);
  }

  private async ensureSlugAvailable(slug: string, exceptId?: number) {
    const existing = await this.prisma.contentPage.findFirst({
      where: {
        slug,
        ...(exceptId ? { NOT: { id: exceptId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Đường dẫn trang đã tồn tại');
    }
  }

  private async findAdminPage(id: number) {
    const page = await this.prisma.contentPage.findUnique({ where: { id } });
    if (!page) throw new NotFoundException('Không tìm thấy trang nội dung');
    return page;
  }

  async getNavigation() {
    return this.prisma.contentPage.findMany({
      where: {
        isPublished: true,
        OR: [{ showInHeader: true }, { showInFooter: true }],
      },
      select: {
        id: true,
        slug: true,
        title: true,
        category: true,
        showInHeader: true,
        showInFooter: true,
        sortOrder: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    });
  }

  async findPublishedBySlug(slug: string) {
    const page = await this.prisma.contentPage.findFirst({
      where: { slug, isPublished: true },
      select: publicSelect,
    });

    if (!page) throw new NotFoundException('Trang này chưa được công khai');
    return page;
  }

  async findAllForAdmin(query: ListContentPagesDto) {
    const search = query.q?.trim();
    return this.prisma.contentPage.findMany({
      where: {
        ...(query.category ? { category: query.category } : {}),
        ...(query.status === 'PUBLISHED'
          ? { isPublished: true }
          : query.status === 'DRAFT'
            ? { isPublished: false }
            : {}),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: 'insensitive' } },
                { summary: { contains: search, mode: 'insensitive' } },
                { slug: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        updatedBy: {
          select: {
            email: true,
            profile: { select: { fullName: true } },
          },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    });
  }

  async create(actorId: number, dto: CreateContentPageDto) {
    const title = dto.title.trim();
    const slug = this.normalizeSlug(dto.slug?.trim() || title);
    if (!slug) throw new ConflictException('Không thể tạo đường dẫn cho trang');
    await this.ensureSlugAvailable(slug);

    const page = await this.prisma.contentPage.create({
      data: {
        title,
        slug,
        summary: dto.summary?.trim() || null,
        content: dto.content.trim(),
        category: dto.category,
        isPublished: dto.isPublished ?? false,
        showInHeader: dto.showInHeader ?? false,
        showInFooter: dto.showInFooter ?? true,
        sortOrder: dto.sortOrder ?? 0,
        updatedById: actorId,
      },
    });

    await writeAuditLog(this.prisma, {
      actorId,
      module: 'CONTENT',
      action: 'CREATE_CONTENT_PAGE',
      entityType: 'ContentPage',
      entityId: page.id,
      description: `Tạo trang nội dung “${page.title}”`,
      afterData: page,
    });
    return page;
  }

  async update(actorId: number, id: number, dto: UpdateContentPageDto) {
    const before = await this.findAdminPage(id);
    const slug = dto.slug ? this.normalizeSlug(dto.slug) : undefined;
    if (dto.slug && !slug) {
      throw new ConflictException('Đường dẫn trang không hợp lệ');
    }
    if (slug && slug !== before.slug) await this.ensureSlugAvailable(slug, id);

    const page = await this.prisma.contentPage.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(slug !== undefined ? { slug } : {}),
        ...(dto.summary !== undefined
          ? { summary: dto.summary.trim() || null }
          : {}),
        ...(dto.content !== undefined ? { content: dto.content.trim() } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.isPublished !== undefined
          ? { isPublished: dto.isPublished }
          : {}),
        ...(dto.showInHeader !== undefined
          ? { showInHeader: dto.showInHeader }
          : {}),
        ...(dto.showInFooter !== undefined
          ? { showInFooter: dto.showInFooter }
          : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        updatedById: actorId,
      },
    });

    await writeAuditLog(this.prisma, {
      actorId,
      module: 'CONTENT',
      action: 'UPDATE_CONTENT_PAGE',
      entityType: 'ContentPage',
      entityId: page.id,
      description: `Cập nhật trang nội dung “${page.title}”`,
      beforeData: before,
      afterData: page,
    });
    return page;
  }

  async updateStatus(actorId: number, id: number, isPublished: boolean) {
    const before = await this.findAdminPage(id);
    const page = await this.prisma.contentPage.update({
      where: { id },
      data: { isPublished, updatedById: actorId },
    });

    await writeAuditLog(this.prisma, {
      actorId,
      module: 'CONTENT',
      action: isPublished ? 'PUBLISH_CONTENT_PAGE' : 'UNPUBLISH_CONTENT_PAGE',
      entityType: 'ContentPage',
      entityId: page.id,
      description: `${isPublished ? 'Công khai' : 'Ẩn'} trang “${page.title}”`,
      beforeData: before,
      afterData: page,
    });
    return page;
  }
}
