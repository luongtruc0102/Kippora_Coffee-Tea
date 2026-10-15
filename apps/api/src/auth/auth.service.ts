import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'crypto';
import { getAuthSessionTtlHours } from './auth-session.config';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { PasswordResetMailService } from './password-reset-mail.service';

const PASSWORD_RESET_RESPONSE =
  'Nếu email tồn tại, Kippora đã gửi mã OTP khôi phục mật khẩu.';
const PASSWORD_RESET_MAX_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly passwordResetMail: PasswordResetMailService,
  ) {}

  private getPasswordResetTtlMinutes() {
    const configured = Number(process.env.PASSWORD_RESET_TTL_MINUTES ?? 10);
    if (!Number.isFinite(configured)) return 10;
    return Math.min(30, Math.max(5, Math.round(configured)));
  }

  private hashResetOtp(challengeId: string, otp: string) {
    const secret =
      process.env.PASSWORD_RESET_SECRET ||
      process.env.JWT_SECRET ||
      'kippora-development-password-reset-secret';
    return createHmac('sha256', secret)
      .update(`${challengeId}:${otp}`)
      .digest('hex');
  }

  private invalidResetOtp() {
    return new BadRequestException(
      'Mã OTP không đúng, đã hết hạn hoặc đã được sử dụng',
    );
  }

  //Đăng ký
  async register(registerDto: RegisterDto) {
    const { email, password, fullName } = registerDto;

    // Kiểm tra email đã tồn tại hay chưa
    const existingUser = await this.usersService.findByEmail(email);

    if (existingUser) {
      throw new ConflictException('Email đã được sử dụng');
    }

    // Tài khoản đầu tiên của hệ thống là ADMIN.
    // Những tài khoản tự đăng ký sau đó đều là USER.
    const userCount = await this.prisma.user.count();

    const roleName = userCount === 0 ? 'ADMIN' : 'USER';

    const userRole = await this.prisma.role.findUnique({
      where: {
        name: roleName,
      },
    });

    if (!userRole) {
      throw new InternalServerErrorException(`Không tìm thấy Role ${roleName}`);
    }

    // Hash mật khẩu trước khi lưu vào database
    const hashedPassword = await argon2.hash(password);

    const user = await this.usersService.create(
      email,
      hashedPassword,
      fullName,
      userRole.id,
    );

    // Không trả password về client
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role.name,
      createdAt: user.createdAt,
    };
  }

  //Đăng nhập
  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Tìm tài khoản theo email
    const user = await this.usersService.findByEmail(email);

    // Không tìm thấy email => đăng nhập thất bại
    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    // Không cho tài khoản bị khóa đăng nhập
    if (!user.isActive) {
      throw new UnauthorizedException('Tài khoản đã bị khóa');
    }

    // So sánh password người dùng nhập với password đã hash trong database
    const isPasswordValid = await argon2.verify(user.password, password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    const sessionId = randomUUID();
    const sessionTtlHours = getAuthSessionTtlHours(
      process.env.AUTH_SESSION_TTL_HOURS,
    );
    const expiresAt = new Date(Date.now() + sessionTtlHours * 60 * 60 * 1000);

    // Mỗi token gắn với một phiên trong database để có thể thu hồi khi đăng xuất.
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role.name,
      sid: sessionId,
    };

    // Tạo Access Token trước, chỉ trả về sau khi phiên đã được lưu thành công.
    const accessToken = await this.jwtService.signAsync(payload);

    await this.prisma.$transaction([
      this.prisma.authSession.create({
        data: {
          id: sessionId,
          userId: user.id,
          expiresAt,
        },
      }),
      // Dọn các phiên đã hết hạn từ lâu để bảng không tăng vô hạn.
      this.prisma.authSession.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            {
              revokedAt: {
                lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              },
            },
          ],
        },
      }),
    ]);

    // Trả thông tin đăng nhập về client
    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        role: user.role.name,
        branch: user.branch
          ? {
              id: user.branch.id,
              code: user.branch.code,
              name: user.branch.name,
            }
          : null,
      },
    };
  }

  async requestPasswordReset(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        email: { equals: dto.email, mode: 'insensitive' },
      },
      select: { id: true, email: true, isActive: true },
    });

    // Không tiết lộ tài khoản có tồn tại hoặc đang bị khóa.
    if (!user || !user.isActive) {
      return { message: PASSWORD_RESET_RESPONSE };
    }

    const challengeId = randomUUID();
    const otp = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const ttlMinutes = this.getPasswordResetTtlMinutes();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

    await this.prisma.$transaction([
      // Chỉ mã mới nhất còn hiệu lực; yêu cầu lại sẽ hủy mã trước đó.
      this.prisma.passwordResetChallenge.updateMany({
        where: { userId: user.id, consumedAt: null },
        data: { consumedAt: now },
      }),
      this.prisma.passwordResetChallenge.create({
        data: {
          id: challengeId,
          userId: user.id,
          otpHash: this.hashResetOtp(challengeId, otp),
          expiresAt,
        },
      }),
      this.prisma.passwordResetChallenge.deleteMany({
        where: {
          expiresAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    try {
      await this.passwordResetMail.sendPasswordResetOtp(
        user.email,
        otp,
        ttlMinutes,
      );
    } catch (error) {
      await this.prisma.passwordResetChallenge.updateMany({
        where: { id: challengeId, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      throw error;
    }

    return { message: PASSWORD_RESET_RESPONSE };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const challenge = await this.prisma.passwordResetChallenge.findFirst({
      where: {
        consumedAt: null,
        user: {
          email: { equals: dto.email, mode: 'insensitive' },
        },
      },
      select: {
        id: true,
        otpHash: true,
        attempts: true,
        expiresAt: true,
        user: {
          select: {
            id: true,
            password: true,
            isActive: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    if (
      !challenge ||
      !challenge.user.isActive ||
      challenge.expiresAt <= now ||
      challenge.attempts >= PASSWORD_RESET_MAX_ATTEMPTS
    ) {
      if (challenge) {
        await this.prisma.passwordResetChallenge.updateMany({
          where: { id: challenge.id, consumedAt: null },
          data: { consumedAt: now },
        });
      }
      throw this.invalidResetOtp();
    }

    const expectedHash = Buffer.from(challenge.otpHash, 'hex');
    const receivedHash = Buffer.from(
      this.hashResetOtp(challenge.id, dto.otp),
      'hex',
    );
    const validOtp =
      expectedHash.length === receivedHash.length &&
      timingSafeEqual(expectedHash, receivedHash);

    if (!validOtp) {
      const isLastAttempt =
        challenge.attempts + 1 >= PASSWORD_RESET_MAX_ATTEMPTS;
      await this.prisma.passwordResetChallenge.updateMany({
        where: { id: challenge.id, consumedAt: null },
        data: {
          attempts: { increment: 1 },
          ...(isLastAttempt ? { consumedAt: now } : {}),
        },
      });
      throw this.invalidResetOtp();
    }

    const isSamePassword = await argon2.verify(
      challenge.user.password,
      dto.newPassword,
    );
    if (isSamePassword) {
      throw new BadRequestException(
        'Mật khẩu mới phải khác mật khẩu đang sử dụng',
      );
    }

    const hashedPassword = await argon2.hash(dto.newPassword);

    await this.prisma.$transaction(async (tx) => {
      // Claim bằng đúng số lần thử để hai request đồng thời không thể cùng dùng OTP.
      const claimed = await tx.passwordResetChallenge.updateMany({
        where: {
          id: challenge.id,
          consumedAt: null,
          attempts: challenge.attempts,
          expiresAt: { gt: now },
        },
        data: { consumedAt: now },
      });

      if (claimed.count !== 1) {
        throw this.invalidResetOtp();
      }

      await tx.user.update({
        where: { id: challenge.user.id },
        data: { password: hashedPassword },
      });

      // Đặt lại mật khẩu là một sự kiện nhạy cảm: thu hồi toàn bộ phiên cũ.
      await tx.authSession.updateMany({
        where: { userId: challenge.user.id, revokedAt: null },
        data: { revokedAt: now },
      });

      await tx.passwordResetChallenge.updateMany({
        where: {
          userId: challenge.user.id,
          id: { not: challenge.id },
          consumedAt: null,
        },
        data: { consumedAt: now },
      });
    });

    return {
      message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.',
    };
  }

  // Lấy thông tin User hiện tại trực tiếp từ database
  async getProfile(userId: number) {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('Tài khoản không tồn tại');
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      address: user.address,
      loyaltyPoints: user.loyaltyPoints,
      role: user.role.name,
      createdAt: user.createdAt,
    };
  }

  // Cập nhật hồ sơ của user hiện tại.
  // Email và role không nhận từ client để tránh thay đổi trái phép.
  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },

      select: {
        id: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Tài khoản không tồn tại');
    }

    const normalizedPhone = dto.phone?.trim();

    // Phone có unique constraint nên kiểm tra trước để trả thông báo dễ hiểu.
    if (normalizedPhone) {
      const existingPhone = await this.prisma.userProfile.findFirst({
        where: {
          phone: normalizedPhone,

          userId: {
            not: userId,
          },
        },

        select: {
          userId: true,
        },
      });

      if (existingPhone) {
        throw new ConflictException('Số điện thoại đã được sử dụng');
      }
    }

    await this.prisma.$transaction([
      this.prisma.userProfile.upsert({
        where: { userId },
        create: {
          userId,
          ...(dto.fullName !== undefined
            ? { fullName: dto.fullName.trim() }
            : {}),
          ...(dto.phone !== undefined ? { phone: normalizedPhone } : {}),
          ...(dto.avatarUrl !== undefined
            ? { avatarUrl: dto.avatarUrl.trim() }
            : {}),
        },
        update: {
          ...(dto.fullName !== undefined
            ? { fullName: dto.fullName.trim() }
            : {}),
          ...(dto.phone !== undefined ? { phone: normalizedPhone } : {}),
          ...(dto.avatarUrl !== undefined
            ? { avatarUrl: dto.avatarUrl.trim() }
            : {}),
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { updatedAt: new Date() },
      }),
    ]);

    // Giữ nguyên cấu trúc response cũ để frontend không phải đổi theo database.
    return this.getProfile(userId);
  }

  /**
   * Đổi mật khẩu cho tài khoản hiện tại.
   * Luôn kiểm tra mật khẩu cũ và chỉ lưu mật khẩu mới sau khi đã hash.
   */
  async changePassword(
    userId: number,
    currentSessionId: string,
    dto: ChangePasswordDto,
  ) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },

      select: {
        id: true,
        password: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Tài khoản không tồn tại');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Tài khoản đã bị khóa');
    }

    const currentPasswordValid = await argon2.verify(
      user.password,
      dto.currentPassword,
    );

    if (!currentPasswordValid) {
      throw new UnauthorizedException('Mật khẩu hiện tại không chính xác');
    }

    const isSamePassword = await argon2.verify(user.password, dto.newPassword);

    if (isSamePassword) {
      throw new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại');
    }

    const hashedPassword = await argon2.hash(dto.newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: {
          id: userId,
        },

        data: {
          password: hashedPassword,
        },
      }),
      // Giữ phiên đang đổi mật khẩu, thu hồi các thiết bị đăng nhập trước đó.
      this.prisma.authSession.updateMany({
        where: {
          userId,
          id: { not: currentSessionId },
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      }),
    ]);

    return {
      message: 'Đổi mật khẩu thành công',
    };
  }

  async logout(userId: number, sessionId: string) {
    await this.prisma.authSession.updateMany({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    return { message: 'Đăng xuất thành công' };
  }
}
