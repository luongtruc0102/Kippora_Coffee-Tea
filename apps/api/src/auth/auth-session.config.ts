const DEFAULT_SESSION_TTL_HOURS = 24 * 7;
const MIN_SESSION_TTL_HOURS = 1;
const MAX_SESSION_TTL_HOURS = 24 * 30;

/**
 * Giới hạn thời gian sống phía máy chủ để token bị lộ không tồn tại vô hạn.
 * Frontend dùng sessionStorage nên phiên trên thiết bị vẫn kết thúc khi đóng web.
 */
export function getAuthSessionTtlHours(value?: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_SESSION_TTL_HOURS;

  return Math.min(
    MAX_SESSION_TTL_HOURS,
    Math.max(MIN_SESSION_TTL_HOURS, Math.floor(parsed)),
  );
}

export function getAuthSessionTtlSeconds(value?: string): number {
  return getAuthSessionTtlHours(value) * 60 * 60;
}
