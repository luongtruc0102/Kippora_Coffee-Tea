import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './../src/app.module';
import { configureApplication } from './../src/app.setup';

describe('Kippora API (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    configureApplication(app);
    await app.init();
  });

  it('/health (GET) kiểm tra API và database', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'Kippora API',
      database: 'connected',
    });
    expect(typeof (response.body as { timestamp: unknown }).timestamp).toBe(
      'string',
    );
  });

  it('/health/live không phụ thuộc truy vấn nghiệp vụ', async () => {
    const response = await request(app.getHttpServer())
      .get('/health/live')
      .expect(200);
    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'Kippora API',
    });
    expect(response.body).not.toHaveProperty('database');
  });

  it('/health/ready xác nhận database sẵn sàng', async () => {
    await request(app.getHttpServer())
      .get('/health/ready')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          status: 'ok',
          database: 'connected',
        });
      });
  });

  it('gắn security headers và ẩn công nghệ máy chủ', async () => {
    const response = await request(app.getHttpServer())
      .get('/health/live')
      .expect(200);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['content-security-policy']).toBeDefined();
  });

  it('không cấp CORS cho origin ngoài danh sách', async () => {
    const response = await request(app.getHttpServer())
      .get('/health/live')
      .set('Origin', 'https://evil.example')
      .expect(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('từ chối endpoint riêng tư khi không có token', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
    await request(app.getHttpServer()).get('/store/settings').expect(401);
    await request(app.getHttpServer()).post('/uploads/avatars').expect(401);
  });

  it('ValidationPipe loại request có trường lạ trước khi vào đăng nhập', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'not-an-email',
        password: '123',
        role: 'ADMIN',
      })
      .expect(400);
    const body = response.body as { message: unknown };
    expect(body.message).toEqual(
      expect.arrayContaining([
        expect.stringContaining('property role should not exist'),
      ]),
    );
  });

  afterAll(async () => {
    await app.close();
  });
});
