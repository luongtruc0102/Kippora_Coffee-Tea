import { BadRequestException } from '@nestjs/common';
import { closeSync, existsSync, openSync, readSync, unlinkSync } from 'fs';

export const SAFE_IMAGE_MIME_TYPES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

export function hasValidFileSignature(mimeType: string, bytes: Buffer) {
  if (mimeType === 'image/jpeg') {
    return (
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    );
  }
  if (mimeType === 'image/png') {
    return (
      bytes.length >= 8 &&
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    );
  }
  if (mimeType === 'image/webp') {
    return (
      bytes.length >= 12 &&
      bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
      bytes.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
  if (mimeType === 'application/pdf') {
    return (
      bytes.length >= 5 && bytes.subarray(0, 5).toString('ascii') === '%PDF-'
    );
  }
  return false;
}

export function assertUploadedFileSignature(
  file: Express.Multer.File | undefined,
  missingMessage: string,
) {
  if (!file) throw new BadRequestException(missingMessage);

  const header = Buffer.alloc(16);
  let bytesRead = 0;
  try {
    const descriptor = openSync(file.path, 'r');
    try {
      bytesRead = readSync(descriptor, header, 0, header.length, 0);
    } finally {
      closeSync(descriptor);
    }
  } catch {
    if (existsSync(file.path)) unlinkSync(file.path);
    throw new BadRequestException('Không thể kiểm tra nội dung file tải lên');
  }

  if (!hasValidFileSignature(file.mimetype, header.subarray(0, bytesRead))) {
    if (existsSync(file.path)) unlinkSync(file.path);
    throw new BadRequestException(
      'Nội dung file không đúng với định dạng được khai báo',
    );
  }

  return file;
}
