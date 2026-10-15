const PLACEHOLDER_PREFIX = 'replace-with-';

function text(env: Record<string, unknown>, key: string) {
  const value = env[key];
  return typeof value === 'string' ? value.trim() : '';
}

function requireSecret(
  env: Record<string, unknown>,
  key: string,
  minimumLength = 32,
) {
  const value = text(env, key);
  if (
    !value ||
    value.length < minimumLength ||
    value.startsWith(PLACEHOLDER_PREFIX)
  ) {
    throw new Error(
      `${key} phải là chuỗi bí mật tối thiểu ${minimumLength} ký tự`,
    );
  }
  return value;
}

export function validateEnvironment(env: Record<string, unknown>) {
  if (!text(env, 'DATABASE_URL')) {
    throw new Error('DATABASE_URL chưa được cấu hình');
  }
  if (!text(env, 'JWT_SECRET')) {
    throw new Error('JWT_SECRET chưa được cấu hình');
  }

  const sessionHours = Number(text(env, 'AUTH_SESSION_TTL_HOURS') || 168);
  if (
    !Number.isFinite(sessionHours) ||
    sessionHours < 1 ||
    sessionHours > 720
  ) {
    throw new Error(
      'AUTH_SESSION_TTL_HOURS phải nằm trong khoảng 1 đến 720 giờ',
    );
  }

  if (text(env, 'NODE_ENV') !== 'production') return env;

  const jwtSecret = requireSecret(env, 'JWT_SECRET');
  const resetSecret = requireSecret(env, 'PASSWORD_RESET_SECRET');
  requireSecret(env, 'BANK_WEBHOOK_SECRET');
  if (jwtSecret === resetSecret) {
    throw new Error('PASSWORD_RESET_SECRET phải khác JWT_SECRET');
  }

  const apiPublicUrl = text(env, 'API_PUBLIC_URL');
  if (!apiPublicUrl.startsWith('https://')) {
    throw new Error('API_PUBLIC_URL production phải sử dụng HTTPS');
  }

  const origins = text(env, 'CORS_ORIGINS')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (
    origins.length === 0 ||
    origins.some((origin) => origin === '*' || !origin.startsWith('https://'))
  ) {
    throw new Error(
      'CORS_ORIGINS production chỉ được chứa HTTPS origin cụ thể',
    );
  }

  if (text(env, 'MAIL_DELIVERY_MODE') !== 'smtp') {
    throw new Error('Production phải sử dụng MAIL_DELIVERY_MODE=smtp');
  }
  for (const key of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM']) {
    if (!text(env, key)) throw new Error(`${key} chưa được cấu hình`);
  }

  return env;
}
