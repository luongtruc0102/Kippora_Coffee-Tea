import { SetMetadata } from '@nestjs/common';

// Đánh dấu API được phép truy cập mà không cần đăng nhập
export const IS_PUBLIC_KEY = 'isPublic';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
