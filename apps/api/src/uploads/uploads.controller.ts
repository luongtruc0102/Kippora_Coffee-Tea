import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Roles } from '../common/decorators/roles.decorator';
import { mkdirSync } from 'fs';

@Controller('uploads')
export class UploadsController {
  @Roles('ADMIN')
  @Post('products')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/products',

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
    return {
      imageUrl: `http://localhost:4000/uploads/products/${file.filename}`,
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
