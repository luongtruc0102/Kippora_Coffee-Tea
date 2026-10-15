import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { basename, extname, join } from 'path';
import { Roles } from '../common/decorators/roles.decorator';
import { createReadStream, existsSync, mkdirSync } from 'fs';
import type { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

interface AuthenticatedRequest extends Request {
  user: {
    sub: number;
    role: string;
  };
}

@Controller('uploads')
export class UploadsController {
  constructor(private readonly prisma: PrismaService) {}

  @Roles('ADMIN')
  @Post('products')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_request, _file, callback) => {
          const directory = './uploads/products';
          mkdirSync(directory, { recursive: true });
          callback(null, directory);
        },

        filename: (_request, file, callback) => {
          const extension = extname(file.originalname);

          const filename = `${Date.now()}-${Math.round(
            Math.random() * 1e9,
          )}${extension}`;

          callback(null, filename);
        },
      }),

      limits: {
        fileSize: 5 * 1024 * 1024,
      },

      fileFilter: (_request, file, callback) => {
        if (!file.mimetype.startsWith('image/')) {
          return callback(new Error('Chỉ được tải lên file hình ảnh'), false);
        }

        callback(null, true);
      },
    }),
  )
  uploadProductImage(
    @UploadedFile()
    file: Express.Multer.File,
  ) {
    const apiUrl =
      process.env.API_PUBLIC_URL ??
      `http://localhost:${process.env.PORT ?? 4000}`;
    return {
      imageUrl: `${apiUrl}/uploads/products/${file.filename}`,
    };
  }

  // Ảnh banner cần tỉ lệ ngang và được công khai trên trang chủ.
  @Roles('ADMIN')
  @Post('banners')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_request, _file, callback) => {
          const directory = './uploads/banners';
          mkdirSync(directory, { recursive: true });
          callback(null, directory);
        },
        filename: (_request, file, callback) => {
          const extensionByMime: Record<string, string> = {
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'image/webp': '.webp',
          };
          callback(
            null,
            `${Date.now()}-${Math.round(Math.random() * 1e9)}${extensionByMime[file.mimetype]}`,
          );
        },
      }),
      limits: { fileSize: 8 * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.mimetype)) {
          return callback(
            new Error('Ảnh banner chỉ hỗ trợ JPG, PNG hoặc WEBP'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  uploadBannerImage(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('Vui lòng chọn ảnh banner');
    const apiUrl =
      process.env.API_PUBLIC_URL ??
      `http://localhost:${process.env.PORT ?? 4000}`;
    return {
      imageUrl: `${apiUrl}/uploads/banners/${file.filename}`,
    };
  }

  // ADMIN tải ảnh topping, tách thư mục riêng để dễ quản lý tài nguyên.
  @Roles('ADMIN')
  @Post('toppings')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_request, _file, callback) => {
          const directory = './uploads/toppings';
          mkdirSync(directory, { recursive: true });
          callback(null, directory);
        },
        filename: (_request, file, callback) => {
          const extensionByMime: Record<string, string> = {
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'image/webp': '.webp',
          };
          const extension = extensionByMime[file.mimetype];
          callback(
            null,
            `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`,
          );
        },
      }),
      limits: { fileSize: 3 * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.mimetype)) {
          return callback(
            new Error('Ảnh topping chỉ hỗ trợ JPG, PNG hoặc WEBP'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  uploadToppingImage(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn ảnh topping');
    }

    const apiUrl =
      process.env.API_PUBLIC_URL ??
      `http://localhost:${process.env.PORT ?? 4000}`;

    return {
      imageUrl: `${apiUrl}/uploads/toppings/${file.filename}`,
    };
  }

  // Nhân viên tải minh chứng cho yêu cầu nghỉ đột xuất. Chỉ nhận ảnh hoặc PDF,
  // giới hạn dung lượng để không biến kho uploads thành nơi lưu file tùy ý.
  @Roles('STAFF')
  @Post('leave-evidence')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_request, _file, callback) => {
          const directory = './uploads/leave-evidence';
          mkdirSync(directory, { recursive: true });
          callback(null, directory);
        },
        filename: (_request, file, callback) => {
          const extensionByMime: Record<string, string> = {
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'image/webp': '.webp',
            'application/pdf': '.pdf',
          };
          callback(
            null,
            `${Date.now()}-${Math.round(Math.random() * 1e9)}${extensionByMime[file.mimetype]}`,
          );
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        const allowedTypes = [
          'image/jpeg',
          'image/png',
          'image/webp',
          'application/pdf',
        ];
        if (!allowedTypes.includes(file.mimetype)) {
          return callback(
            new Error('Minh chứng chỉ hỗ trợ JPG, PNG, WEBP hoặc PDF'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  uploadLeaveEvidence(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('Vui lòng chọn file minh chứng');
    const apiUrl =
      process.env.API_PUBLIC_URL ??
      `http://localhost:${process.env.PORT ?? 4000}`;
    return {
      evidenceUrl: `${apiUrl}/uploads/leave-evidence/${file.filename}`,
    };
  }

  @Roles('ADMIN', 'BRANCH_MANAGER', 'STAFF')
  @Get('leave-evidence/:filename')
  async viewLeaveEvidence(
    @Req() request: AuthenticatedRequest,
    @Param('filename') filename: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const safeFilename = basename(filename);
    if (
      safeFilename !== filename ||
      !/^\d+-\d+\.(jpg|jpeg|png|webp|pdf)$/i.test(safeFilename)
    ) {
      throw new NotFoundException('Không tìm thấy file minh chứng');
    }

    const leaveRequest = await this.prisma.staffLeaveRequest.findFirst({
      where: {
        evidenceUrl: {
          endsWith: `/uploads/leave-evidence/${safeFilename}`,
        },
      },
      select: {
        employeeId: true,
        branch: { select: { managerId: true } },
      },
    });

    const canView =
      request.user.role === 'ADMIN' ||
      (request.user.role === 'STAFF' &&
        leaveRequest?.employeeId === request.user.sub) ||
      (request.user.role === 'BRANCH_MANAGER' &&
        leaveRequest?.branch.managerId === request.user.sub);

    // Trả 404 thay vì tiết lộ file có tồn tại cho tài khoản không có quyền.
    if (!leaveRequest || !canView) {
      throw new NotFoundException('Không tìm thấy file minh chứng');
    }

    const filePath = join(
      process.cwd(),
      'uploads',
      'leave-evidence',
      safeFilename,
    );
    if (!existsSync(filePath)) {
      throw new NotFoundException('File minh chứng không còn tồn tại');
    }

    const contentTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
    };
    response.setHeader(
      'Content-Type',
      contentTypes[extname(safeFilename).toLowerCase()] ??
        'application/octet-stream',
    );
    response.setHeader(
      'Content-Disposition',
      `inline; filename="${safeFilename}"`,
    );
    response.setHeader('Cache-Control', 'private, no-store');

    return new StreamableFile(createReadStream(filePath));
  }

  // User đã đăng nhập tải avatar.
  // Không dùng @Roles nên ADMIN, STAFF và USER đều có thể dùng.
  @Post('avatars')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_request, _file, callback) => {
          const directory = './uploads/avatars';

          mkdirSync(directory, {
            recursive: true,
          });

          callback(null, directory);
        },

        filename: (_request, file, callback) => {
          const extensionByMime: Record<string, string> = {
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'image/webp': '.webp',
          };

          const extension = extensionByMime[file.mimetype];

          const filename = `${Date.now()}-${Math.round(
            Math.random() * 1e9,
          )}${extension}`;

          callback(null, filename);
        },
      }),

      limits: {
        fileSize: 2 * 1024 * 1024,
      },

      fileFilter: (_request, file, callback) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

        if (!allowedTypes.includes(file.mimetype)) {
          return callback(
            new Error('Avatar chỉ hỗ trợ JPG, PNG hoặc WEBP'),
            false,
          );
        }

        callback(null, true);
      },
    }),
  )
  uploadAvatar(
    @UploadedFile()
    file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn ảnh đại diện');
    }

    const apiUrl =
      process.env.API_PUBLIC_URL ??
      `http://localhost:${process.env.PORT ?? 4000}`;

    return {
      imageUrl: `${apiUrl}/uploads/avatars/${file.filename}`,
    };
  }
}
