import { validateEnvironment } from './environment.validation';

const productionEnvironment = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://user:password@database:5432/kippora',
  JWT_SECRET: 'jwt-secret-with-more-than-thirty-two-characters',
  PASSWORD_RESET_SECRET: 'reset-secret-with-more-than-thirty-two-characters',
  BANK_WEBHOOK_SECRET: 'webhook-secret-with-more-than-thirty-two-characters',
  AUTH_SESSION_TTL_HOURS: '168',
  API_PUBLIC_URL: 'https://api.kippora.vn',
  CORS_ORIGINS: 'https://kippora.vn,https://admin.kippora.vn',
  MAIL_DELIVERY_MODE: 'smtp',
  SMTP_HOST: 'smtp.example.com',
  SMTP_USER: 'mailer',
  SMTP_PASSWORD: 'smtp-password',
  SMTP_FROM: 'Kippora <no-reply@kippora.vn>',
};

describe('validateEnvironment', () => {
  it('cho phép cấu hình production an toàn', () => {
    expect(validateEnvironment({ ...productionEnvironment })).toMatchObject({
      NODE_ENV: 'production',
    });
  });

  it('từ chối secret mẫu ở production', () => {
    expect(() =>
      validateEnvironment({
        ...productionEnvironment,
        JWT_SECRET: 'replace-with-a-long-random-secret',
      }),
    ).toThrow('JWT_SECRET');
  });

  it('từ chối wildcard hoặc HTTP origin ở production', () => {
    expect(() =>
      validateEnvironment({
        ...productionEnvironment,
        CORS_ORIGINS: '*',
      }),
    ).toThrow('CORS_ORIGINS');
  });

  it('từ chối chế độ gửi OTP ra console ở production', () => {
    expect(() =>
      validateEnvironment({
        ...productionEnvironment,
        MAIL_DELIVERY_MODE: 'console',
      }),
    ).toThrow('MAIL_DELIVERY_MODE=smtp');
  });
});
