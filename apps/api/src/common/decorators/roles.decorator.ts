import { SetMetadata } from '@nestjs/common';

// Tên metadata dùng để lưu danh sách Role được phép truy cập
export const ROLES_KEY = 'roles';

// Gắn các Role được phép truy cập vào API
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
