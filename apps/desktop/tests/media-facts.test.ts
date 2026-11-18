import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mimeForPath, readMediaFileFacts } from '../src/main/mediaFacts';

let dir = '';

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'doru-media-facts-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('media file facts', () => {
  it('derives MIME, size and PNG dimensions from the file', async () => {
    const path = join(dir, 'photo.png');
    const bytes = Buffer.alloc(24);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes, 0);
    bytes.writeUInt32BE(1920, 16);
    bytes.writeUInt32BE(1080, 20);
    writeFileSync(path, bytes);

    await expect(readMediaFileFacts(path)).resolves.toEqual({
      mime: 'image/png',
      size: 24,
      width: 1920,
      height: 1080,
    });
  });

  it('reads GIF, JPEG and WebP dimensions', async () => {
    const gif = Buffer.alloc(10);
    gif.write('GIF89a', 0, 'ascii');
    gif.writeUInt16LE(320, 6);
    gif.writeUInt16LE(200, 8);
    expect(await readMediaFileFacts(write('image.gif', gif))).toMatchObject({ width: 320, height: 200 });

    const jpeg = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x00, 0x03, 0x00, 0x03, 0x01,
      0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
    ]);
    expect(await readMediaFileFacts(write('image.jpg', jpeg))).toMatchObject({ width: 768, height: 512 });

    const webp = Buffer.alloc(30);
    webp.write('RIFF', 0, 'ascii');
    webp.write('WEBP', 8, 'ascii');
    webp.write('VP8X', 12, 'ascii');
    webp.writeUIntLE(800 - 1, 24, 3);
    webp.writeUIntLE(600 - 1, 27, 3);
    expect(await readMediaFileFacts(write('image.webp', webp))).toMatchObject({ width: 800, height: 600 });
  });

  it('does not open directories as image files', async () => {
    const path = join(dir, 'folder.png');
    mkdirSync(path);
    const facts = await readMediaFileFacts(path);
    expect(facts.mime).toBe('image/png');
    expect(facts.width).toBeUndefined();
    expect(facts.height).toBeUndefined();
  });

  it('falls back to the extension MIME and reports no facts for a missing file', async () => {
    expect(mimeForPath('scan.JPEG')).toBe('image/jpeg');
    expect(mimeForPath('blob.bin')).toBe('application/octet-stream');
    expect(mimeForPath('scan.constructor')).toBe('application/octet-stream');
    await expect(readMediaFileFacts(join(dir, 'missing.jpg'))).resolves.toEqual({ mime: 'image/jpeg' });
    await expect(readMediaFileFacts(join(dir, 'missing.constructor'))).resolves.toEqual({
      mime: 'application/octet-stream',
    });
  });
});

function write(name: string, bytes: Buffer): string {
  const path = join(dir, name);
  writeFileSync(path, bytes);
  return path;
}
