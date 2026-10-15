import * as argon2 from 'argon2';
import { AuthService } from './auth.service';

describe('AuthService server sessions', () => {
  type SessionCreateInput = {
    data: { id: string; userId: number; expiresAt: Date };
  };
  type SessionRevokeInput = {
    where: { id: string; userId: number; revokedAt: null };
    data: { revokedAt: Date };
  };
  type LoginUser = {
    id: number;
    email: string;
    password: string;
    isActive: boolean;
    phone: string | null;
    avatarUrl: string | null;
    fullName: string | null;
    branch: null;
    role: { name: string };
  };
  type SignedPayload = {
    sub: number;
    email: string;
    role: string;
    sid: string;
  };

  let capturedSignedPayload: SignedPayload | undefined;
  let capturedCreateInput: SessionCreateInput | undefined;
  let capturedRevokeInput: SessionRevokeInput | undefined;

  const usersService = {
    findByEmail: jest.fn<(email: string) => Promise<LoginUser | null>>(),
  };
  const prisma = {
    authSession: {
      create: jest.fn<(input: SessionCreateInput) => Promise<{ id: string }>>(),
      deleteMany: jest.fn<(input: unknown) => Promise<{ count: number }>>(),
      updateMany:
        jest.fn<(input: SessionRevokeInput) => Promise<{ count: number }>>(),
    },
    $transaction:
      jest.fn<(operations: Promise<unknown>[]) => Promise<unknown[]>>(),
  };
  const jwtService = {
    signAsync: jest.fn<(payload: SignedPayload) => Promise<string>>(),
  };
  const passwordResetMail = {
    sendPasswordResetOtp: jest.fn(),
  };

  const service = new AuthService(
    usersService as never,
    prisma as never,
    jwtService as never,
    passwordResetMail as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    capturedSignedPayload = undefined;
    capturedCreateInput = undefined;
    capturedRevokeInput = undefined;
    prisma.authSession.create.mockImplementation(
      (input: SessionCreateInput) => {
        capturedCreateInput = input;
        return Promise.resolve({ id: input.data.id });
      },
    );
    prisma.authSession.deleteMany.mockResolvedValue({ count: 0 });
    prisma.authSession.updateMany.mockImplementation(
      (input: SessionRevokeInput) => {
        capturedRevokeInput = input;
        return Promise.resolve({ count: 1 });
      },
    );
    prisma.$transaction.mockImplementation((operations: Promise<unknown>[]) =>
      Promise.all(operations),
    );
    jwtService.signAsync.mockImplementation((payload: SignedPayload) => {
      capturedSignedPayload = payload;
      return Promise.resolve('signed-token');
    });
  });

  it('tạo phiên trong database khi đăng nhập thành công', async () => {
    const password = 'MatKhauAnToan123!';
    usersService.findByEmail.mockResolvedValue({
      id: 7,
      email: 'staff@example.com',
      password: await argon2.hash(password),
      isActive: true,
      phone: null,
      avatarUrl: null,
      fullName: 'Nhân viên',
      branch: null,
      role: { name: 'STAFF' },
    });

    const result = await service.login({
      email: 'staff@example.com',
      password,
    });

    expect(result.accessToken).toBe('signed-token');
    if (!capturedSignedPayload || !capturedCreateInput) {
      throw new Error('Chưa ghi nhận dữ liệu tạo phiên');
    }
    expect(capturedSignedPayload.sub).toBe(7);
    expect(capturedSignedPayload.sid).toEqual(expect.any(String));
    expect(capturedCreateInput.data.id).toBe(capturedSignedPayload.sid);
    expect(capturedCreateInput.data.userId).toBe(7);
    expect(capturedCreateInput.data.expiresAt).toBeInstanceOf(Date);
  });

  it('thu hồi đúng phiên hiện tại khi đăng xuất', async () => {
    await service.logout(7, 'session-7');

    if (!capturedRevokeInput) {
      throw new Error('Chưa ghi nhận dữ liệu thu hồi phiên');
    }
    expect(capturedRevokeInput.where).toEqual({
      id: 'session-7',
      userId: 7,
      revokedAt: null,
    });
    expect(capturedRevokeInput.data.revokedAt).toBeInstanceOf(Date);
  });
});
