import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';

interface JwtPayload {
  sub: number;
  email: string;
  role: string;
  sid: string;
}

interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Không tìm thấy Access Token');
    }

    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException(
        'Access Token không hợp lệ hoặc đã hết hạn',
      );
    }

    if (!payload.sid) {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
    }

    // Luôn kiểm tra user và phiên hiện tại để khóa tài khoản/đăng xuất có hiệu lực ngay.
    const [currentUser, session] = await Promise.all([
      this.prisma.user.findUnique({
        where: {
          id: payload.sub,
        },

        select: {
          email: true,
          isActive: true,

          role: {
            select: {
              name: true,
            },
          },

          staffProfile: {
            select: {
              branch: {
                select: {
                  id: true,
                  isActive: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.authSession.findFirst({
        where: {
          id: payload.sid,
          userId: payload.sub,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: { id: true, lastSeenAt: true },
      }),
    ]);

    if (!currentUser || !currentUser.isActive || !session) {
      throw new UnauthorizedException(
        'Phiên đăng nhập đã kết thúc hoặc tài khoản đã bị khóa',
      );
    }

    const isBranchEmployee =
      currentUser.role.name === 'STAFF' ||
      currentUser.role.name === 'BRANCH_MANAGER';
    const branch = currentUser.staffProfile?.branch;

    if (isBranchEmployee && (!branch || !branch.isActive)) {
      throw new UnauthorizedException('Chi nhánh đang bị khóa');
    }

    // Lấy role từ database để việc đổi quyền có hiệu lực với cả token cũ.
    request.user = {
      sub: payload.sub,
      email: currentUser.email,
      role: currentUser.role.name,
      sid: payload.sid,
    };

    // Chỉ cập nhật mốc hoạt động theo khoảng để không ghi database ở mọi request.
    if (Date.now() - session.lastSeenAt.getTime() >= 5 * 60 * 1000) {
      void this.prisma.authSession
        .update({
          where: { id: session.id },
          data: { lastSeenAt: new Date() },
        })
        .catch(() => undefined);
    }

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
