import { createHmac } from 'crypto';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';

describe('AuthService password reset', () => {
  type ChallengeCreateInput = {
    data: {
      id: string;
      userId: number;
      otpHash: string;
      expiresAt: Date;
    };
  };
  type UserUpdateInput = {
    where: { id: number };
    data: { password: string };
  };
  type SessionUpdateInput = {
    where: { userId: number; revokedAt: null };
    data: { revokedAt: Date };
  };
  let capturedChallengeCreate: ChallengeCreateInput | undefined;
  let capturedUserUpdate: UserUpdateInput | undefined;
  let capturedSessionUpdate: SessionUpdateInput | undefined;

  const prisma = {
    user: {
      findFirst: jest.fn(),
      update: jest.fn<(input: UserUpdateInput) => Promise<{ id: number }>>(),
    },
    passwordResetChallenge: {
      create:
        jest.fn<(input: ChallengeCreateInput) => Promise<{ id: string }>>(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    authSession: {
      updateMany:
        jest.fn<(input: SessionUpdateInput) => Promise<{ count: number }>>(),
    },
    $transaction: jest.fn(),
  };
  const passwordResetMail = {
    sendPasswordResetOtp: jest.fn(),
  };
  const service = new AuthService(
    {} as never,
    prisma as never,
    {} as never,
    passwordResetMail as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    capturedChallengeCreate = undefined;
    capturedUserUpdate = undefined;
    capturedSessionUpdate = undefined;
    process.env.PASSWORD_RESET_SECRET = 'test-reset-secret';
    prisma.passwordResetChallenge.create.mockImplementation(
      (input: ChallengeCreateInput) => {
        capturedChallengeCreate = input;
        return Promise.resolve({ id: 'created' });
      },
    );
    prisma.passwordResetChallenge.updateMany.mockResolvedValue({ count: 1 });
    prisma.passwordResetChallenge.deleteMany.mockResolvedValue({ count: 0 });
    prisma.user.update.mockImplementation((input: UserUpdateInput) => {
      capturedUserUpdate = input;
      return Promise.resolve({ id: 7 });
    });
    prisma.authSession.updateMany.mockImplementation(
      (input: SessionUpdateInput) => {
        capturedSessionUpdate = input;
        return Promise.resolve({ count: 2 });
      },
    );
    passwordResetMail.sendPasswordResetOtp.mockResolvedValue(undefined);
    prisma.$transaction.mockImplementation(
      (input: Promise<unknown>[] | ((tx: typeof prisma) => unknown)) =>
        typeof input === 'function'
          ? Promise.resolve(input(prisma))
          : Promise.all(input),
    );
  });

  it('chỉ lưu bản băm và gửi OTP cho tài khoản hợp lệ', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 7,
      email: 'staff@example.com',
      isActive: true,
    });

    const result = await service.requestPasswordReset({
      email: 'staff@example.com',
    });

    if (!capturedChallengeCreate) {
      throw new Error('Chưa ghi nhận dữ liệu tạo OTP');
    }
    expect(capturedChallengeCreate.data.otpHash).toMatch(/^[a-f0-9]{64}$/);
    expect(capturedChallengeCreate.data).not.toHaveProperty('otp');
    expect(passwordResetMail.sendPasswordResetOtp).toHaveBeenCalledWith(
      'staff@example.com',
      expect.stringMatching(/^\d{6}$/),
      10,
    );
    expect(result.message).toContain('Nếu email tồn tại');
  });

  it('đổi mật khẩu và thu hồi mọi phiên khi OTP chính xác', async () => {
    const challengeId = '5d099084-e9c8-4ab3-a8c0-b482f5c0c4db';
    const otp = '123456';
    const otpHash = createHmac('sha256', 'test-reset-secret')
      .update(`${challengeId}:${otp}`)
      .digest('hex');
    const oldPassword = await argon2.hash('old-password');
    prisma.passwordResetChallenge.findFirst.mockResolvedValue({
      id: challengeId,
      otpHash,
      attempts: 0,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      user: {
        id: 7,
        password: oldPassword,
        isActive: true,
      },
    });

    const result = await service.resetPassword({
      email: 'staff@example.com',
      otp,
      newPassword: 'new-password',
    });

    if (!capturedUserUpdate || !capturedSessionUpdate) {
      throw new Error('Chưa ghi nhận thay đổi mật khẩu hoặc phiên đăng nhập');
    }
    expect(capturedUserUpdate.where).toEqual({ id: 7 });
    expect(typeof capturedUserUpdate.data.password).toBe('string');
    expect(capturedSessionUpdate.where).toEqual({
      userId: 7,
      revokedAt: null,
    });
    expect(capturedSessionUpdate.data.revokedAt).toBeInstanceOf(Date);
    expect(result.message).toContain('Đặt lại mật khẩu thành công');
  });
});
