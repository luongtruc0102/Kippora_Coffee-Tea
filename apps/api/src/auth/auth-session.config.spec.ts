import {
  getAuthSessionTtlHours,
  getAuthSessionTtlSeconds,
} from './auth-session.config';

describe('auth session config', () => {
  it('dùng mặc định 7 ngày khi chưa cấu hình', () => {
    expect(getAuthSessionTtlHours()).toBe(168);
    expect(getAuthSessionTtlSeconds()).toBe(168 * 60 * 60);
  });

  it('giới hạn cấu hình trong khoảng an toàn', () => {
    expect(getAuthSessionTtlHours('0')).toBe(1);
    expect(getAuthSessionTtlHours('9999')).toBe(720);
  });

  it('chấp nhận số giờ hợp lệ và bỏ phần lẻ', () => {
    expect(getAuthSessionTtlHours('48.9')).toBe(48);
  });
});
