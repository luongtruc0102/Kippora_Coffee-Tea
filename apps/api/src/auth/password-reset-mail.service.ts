import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

@Injectable()
export class PasswordResetMailService {
  private readonly logger = new Logger(PasswordResetMailService.name);
  private readonly transporter: Transporter | null;
  private readonly fromAddress: string;
  private readonly consoleMode: boolean;

  constructor() {
    const smtpHost = process.env.SMTP_HOST?.trim();
    const smtpUser = process.env.SMTP_USER?.trim();
    const smtpPassword = process.env.SMTP_PASSWORD;
    this.fromAddress =
      process.env.SMTP_FROM?.trim() || 'Kippora <no-reply@kippora.local>';
    this.consoleMode =
      process.env.NODE_ENV !== 'production' &&
      process.env.MAIL_DELIVERY_MODE?.trim().toLowerCase() === 'console';

    if (!smtpHost) {
      this.transporter = null;
      return;
    }

    const port = Number(process.env.SMTP_PORT ?? 587);
    this.transporter = createTransport({
      host: smtpHost,
      port: Number.isFinite(port) ? port : 587,
      secure:
        process.env.SMTP_SECURE?.trim().toLowerCase() === 'true' ||
        port === 465,
      ...(smtpUser && smtpPassword
        ? { auth: { user: smtpUser, pass: smtpPassword } }
        : {}),
    });
  }

  async sendPasswordResetOtp(
    recipient: string,
    otp: string,
    ttlMinutes: number,
  ) {
    if (this.consoleMode) {
      this.logger.warn(
        `[CHỈ DÙNG KHI PHÁT TRIỂN] OTP khôi phục cho ${recipient}: ${otp}`,
      );
      return;
    }

    if (!this.transporter) {
      throw new ServiceUnavailableException(
        'Hệ thống gửi email chưa được cấu hình. Vui lòng liên hệ quản trị viên.',
      );
    }

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: recipient,
        subject: 'Mã xác nhận khôi phục mật khẩu Kippora',
        text:
          `Mã OTP của bạn là ${otp}. Mã có hiệu lực trong ${ttlMinutes} phút. ` +
          'Nếu bạn không yêu cầu khôi phục mật khẩu, hãy bỏ qua email này.',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#35251e">
            <h2 style="color:#5a3325">Khôi phục mật khẩu Kippora</h2>
            <p>Dùng mã dưới đây để đặt lại mật khẩu:</p>
            <p style="font-size:30px;font-weight:700;letter-spacing:8px;color:#c2763d">${otp}</p>
            <p>Mã có hiệu lực trong <strong>${ttlMinutes} phút</strong> và chỉ dùng được một lần.</p>
            <p style="color:#7c7169">Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.</p>
          </div>
        `,
      });
    } catch {
      throw new ServiceUnavailableException(
        'Chưa thể gửi email OTP. Vui lòng thử lại sau.',
      );
    }
  }
}
