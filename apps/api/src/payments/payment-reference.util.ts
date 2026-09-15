import { randomBytes } from 'crypto';

const QR_LIFETIME_MINUTES = 30;

/**
 * Sinh nội dung chuyển khoản ngắn, chỉ gồm chữ và số để mọi ứng dụng ngân
 * hàng đọc ổn định. Phần ngẫu nhiên khiến hai đơn tạo cùng mili giây không
 * thể dùng chung mã; unique index trong database là lớp bảo vệ cuối cùng.
 */
export function createPaymentReference() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomPart = randomBytes(3).toString('hex').toUpperCase();
  return `KIP${timestamp}${randomPart}`;
}

export function createBankTransferMetadata(method: string) {
  if (method !== 'BANK_TRANSFER') return {};

  return {
    referenceCode: createPaymentReference(),
    expiresAt: new Date(Date.now() + QR_LIFETIME_MINUTES * 60_000),
  };
}
