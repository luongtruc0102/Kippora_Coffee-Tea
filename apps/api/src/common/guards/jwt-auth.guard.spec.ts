import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

function contextFor(request: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard server sessions', () => {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
  const jwtService = { verifyAsync: jest.fn() };
  const prisma = {
    user: { findUnique: jest.fn() },
    authSession: { findFirst: jest.fn(), update: jest.fn() },
  };

  const guard = new JwtAuthGuard(
    jwtService as never,
    reflector as never,
    prisma as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('cho phép token có phiên đang hoạt động', async () => {
    const request = { headers: { authorization: 'Bearer token' } };
    jwtService.verifyAsync.mockResolvedValue({
      sub: 5,
      email: 'staff@example.com',
      role: 'USER',
      sid: 'session-1',
    });
    prisma.user.findUnique.mockResolvedValue({
      email: 'staff@example.com',
      isActive: true,
      role: { name: 'USER' },
      staffProfile: null,
    });
    prisma.authSession.findFirst.mockResolvedValue({
      id: 'session-1',
      lastSeenAt: new Date(),
    });

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request).toHaveProperty('user.sid', 'session-1');
  });

  it('từ chối token của phiên đã đăng xuất', async () => {
    const request = { headers: { authorization: 'Bearer token' } };
    jwtService.verifyAsync.mockResolvedValue({
      sub: 5,
      email: 'staff@example.com',
      role: 'USER',
      sid: 'revoked-session',
    });
    prisma.user.findUnique.mockResolvedValue({
      email: 'staff@example.com',
      isActive: true,
      role: { name: 'USER' },
      staffProfile: null,
    });
    prisma.authSession.findFirst.mockResolvedValue(null);

    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('từ chối token cũ không có mã phiên', async () => {
    const request = { headers: { authorization: 'Bearer token' } };
    jwtService.verifyAsync.mockResolvedValue({
      sub: 5,
      email: 'staff@example.com',
      role: 'USER',
    });

    await expect(guard.canActivate(contextFor(request))).rejects.toThrow(
      'Phiên đăng nhập không hợp lệ',
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
