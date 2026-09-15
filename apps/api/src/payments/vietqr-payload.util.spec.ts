import { buildVietQrPayload } from './vietqr-payload.util';

describe('buildVietQrPayload', () => {
  it('tạo payload động có số tiền, mã tham chiếu và checksum', () => {
    const payload = buildVietQrPayload({
      bankBin: '970415',
      accountNumber: '113366668888',
      amount: 79000,
      referenceCode: 'KIPABC123',
    });

    expect(payload).toContain('000201');
    expect(payload).toContain('010212');
    expect(payload).toContain('A000000727');
    expect(payload).toContain('970415');
    expect(payload).toContain('113366668888');
    expect(payload).toContain('QRIBFTTA');
    expect(payload).toContain('79000');
    expect(payload).toContain('KIPABC123');
    expect(payload).toMatch(/6304[A-F0-9]{4}$/);
  });
});
