import { hasValidFileSignature } from './upload-security.util';

describe('upload security', () => {
  it('nhận diện đúng chữ ký JPG, PNG, WEBP và PDF', () => {
    expect(
      hasValidFileSignature(
        'image/jpeg',
        Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      ),
    ).toBe(true);
    expect(
      hasValidFileSignature(
        'image/png',
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toBe(true);
    expect(
      hasValidFileSignature('image/webp', Buffer.from('RIFF1234WEBP', 'ascii')),
    ).toBe(true);
    expect(
      hasValidFileSignature('application/pdf', Buffer.from('%PDF-1.7')),
    ).toBe(true);
  });

  it('từ chối HTML giả dạng ảnh', () => {
    expect(
      hasValidFileSignature('image/png', Buffer.from('<html>attack</html>')),
    ).toBe(false);
  });
});
