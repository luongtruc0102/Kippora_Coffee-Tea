type VietQrPayloadInput = {
  bankBin: string;
  accountNumber: string;
  amount: number;
  referenceCode: string;
};

function tlv(id: string, value: string) {
  const length = Buffer.byteLength(value, 'utf8');
  if (length > 99) throw new Error(`Trường VietQR ${id} quá dài`);
  return `${id}${String(length).padStart(2, '0')}${value}`;
}

// CRC-16/CCITT-FALSE được EMVCo dùng cho trường kiểm tra cuối payload.
function crc16Ccitt(value: string) {
  let crc = 0xffff;
  for (const byte of Buffer.from(value, 'utf8')) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Tạo payload VietQR chuyển khoản NAPAS 247 hoàn toàn cục bộ. Frontend chỉ
 * biến chuỗi này thành ảnh QR, không gửi số tài khoản hay mã đơn sang bên thứ ba.
 */
export function buildVietQrPayload(input: VietQrPayloadInput) {
  const beneficiary = tlv('00', input.bankBin) + tlv('01', input.accountNumber);
  const merchantAccount =
    tlv('00', 'A000000727') + tlv('01', beneficiary) + tlv('02', 'QRIBFTTA');
  const additionalData = tlv('08', input.referenceCode);
  const amount = String(Math.round(input.amount));
  const withoutChecksum =
    tlv('00', '01') +
    tlv('01', '12') +
    tlv('38', merchantAccount) +
    tlv('53', '704') +
    tlv('54', amount) +
    tlv('58', 'VN') +
    tlv('62', additionalData) +
    '6304';
  return `${withoutChecksum}${crc16Ccitt(withoutChecksum)}`;
}
