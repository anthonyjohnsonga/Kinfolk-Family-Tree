import { test } from 'node:test';
import assert from 'node:assert/strict';

// db.ts requires DATABASE_URL at import time even though these tests never open
// a connection; a placeholder keeps the import from throwing.
process.env.DATABASE_URL ||= 'postgresql://kinfolk:test_only@localhost:5432/kinfolk';
const { decodePhoto, PhotoError } = await import('./photos.js');
const { MAX_PHOTO_BYTES } = await import('./contract.js');

const base64 = (bytes: number) => Buffer.alloc(bytes, 1).toString('base64');

test('decodes a valid image upload to its raw bytes', () => {
  const buffer = decodePhoto({ data: base64(64), contentType: 'image/jpeg' });
  assert.equal(buffer.length, 64);
});

test('rejects an unsupported content type', () => {
  assert.throws(
    () => decodePhoto({ data: base64(8), contentType: 'image/tiff' as never }),
    (error: unknown) => error instanceof PhotoError && error.statusCode === 400,
  );
});

test('rejects data that is not base64', () => {
  assert.throws(
    () => decodePhoto({ data: 'not valid base64!!', contentType: 'image/png' }),
    /base64/,
  );
});

test('rejects an empty payload', () => {
  assert.throws(() => decodePhoto({ data: '', contentType: 'image/png' }), PhotoError);
});

test('rejects an image over the size limit', () => {
  assert.throws(
    () => decodePhoto({ data: base64(MAX_PHOTO_BYTES + 1), contentType: 'image/webp' }),
    (error: unknown) => error instanceof PhotoError && error.statusCode === 413,
  );
});
