import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import {
  ingestMediaBytes,
  ingestMediaFile,
  isAllowedRemoteMediaType,
  MediaIngestError,
  storeIngestedMedia,
} from '../src/main/mediaIngest';

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'doru-media-ingest-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function jpegBytes(width = 8, height = 6): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: '#cc3300' } })
    .jpeg()
    .toBuffer();
}

function avifBytes(width = 8, height = 6): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: '#3366aa' } })
    .avif()
    .toBuffer();
}

function ftyp(major: string, compatible: string[] = []): Buffer {
  const size = 16 + compatible.length * 4;
  const bytes = Buffer.alloc(size);
  bytes.writeUInt32BE(size, 0);
  bytes.write('ftyp', 4, 'ascii');
  bytes.write(major, 8, 'ascii');
  compatible.forEach((brand, index) => bytes.write(brand, 16 + index * 4, 'ascii'));
  return bytes;
}

describe('media ingestion', () => {
  it('converts JPEG to AVIF without changing the dimensions', async () => {
    const ingested = await ingestMediaBytes(await jpegBytes(8, 6), '/photos/Family Portrait.jpg');

    expect(ingested.extension).toBe('avif');
    expect(ingested.width).toBe(8);
    expect(ingested.height).toBe(6);
    const metadata = await sharp(Buffer.from(ingested.bytes)).metadata();
    expect(metadata.format).toBe('heif');
    expect(metadata.width).toBe(8);
    expect(metadata.height).toBe(6);
  });

  it('auto-orients JPEG and reports the stored dimensions', async () => {
    const rotated = await sharp({ create: { width: 4, height: 2, channels: 3, background: '#2f7f3f' } })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
    const ingested = await ingestMediaBytes(rotated, 'rotated.jpg');

    expect(ingested.width).toBe(2);
    expect(ingested.height).toBe(4);
    const metadata = await sharp(Buffer.from(ingested.bytes)).metadata();
    expect(metadata.width).toBe(2);
    expect(metadata.height).toBe(4);
  });

  it('keeps a valid AVIF byte-for-byte', async () => {
    const input = await avifBytes();
    const ingested = await ingestMediaBytes(input, '/photos/Portrait.avif');

    expect(ingested.extension).toBe('avif');
    expect(Buffer.from(ingested.bytes).equals(input)).toBe(true);
  });

  it('rejects content that does not match the extension', async () => {
    await expect(ingestMediaBytes(await jpegBytes(), 'photos/a.avif')).rejects.toMatchObject({
      reason: 'extension-mismatch',
    });
    await expect(ingestMediaBytes(await avifBytes(), 'photos/a.jpg')).rejects.toMatchObject({
      reason: 'extension-mismatch',
    });
    await expect(ingestMediaBytes(await jpegBytes(), 'photos/a.png')).rejects.toMatchObject({
      reason: 'extension-mismatch',
    });
  });

  it('rejects renamed PDF and PNG payloads', async () => {
    await expect(ingestMediaBytes(Buffer.from('%PDF-1.7\nfake'), 'scan.jpg')).rejects.toMatchObject({
      reason: 'unsupported-format',
    });
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#fff' } })
      .png()
      .toBuffer();
    await expect(ingestMediaBytes(png, 'scan.jpg')).rejects.toMatchObject({ reason: 'unsupported-format' });
  });

  it('rejects truncated and corrupt images', async () => {
    await expect(ingestMediaBytes(Buffer.from([0xff, 0xd8, 0xff, 0x00]), 'broken.jpg')).rejects.toMatchObject({
      reason: 'invalid-image',
    });
  });

  it('rejects animated AVIF', async () => {
    await expect(ingestMediaBytes(ftyp('avis', ['avis', 'mif1']), 'animated.avif')).rejects.toMatchObject({
      reason: 'animated',
    });
    await expect(ingestMediaBytes(ftyp('mif1', ['avif', 'avis']), 'animated.avif')).rejects.toMatchObject({
      reason: 'animated',
    });
  });

  it('enforces byte and pixel limits', async () => {
    await expect(ingestMediaBytes(await jpegBytes(), 'large.jpg', { maxBytes: 10 })).rejects.toMatchObject({
      reason: 'too-large',
    });
    await expect(ingestMediaBytes(await jpegBytes(8, 6), 'large.jpg', { maxPixels: 10 })).rejects.toMatchObject({
      reason: 'too-many-pixels',
    });
  });

  it('can ignore the extension for URL-derived images', async () => {
    const ingested = await ingestMediaBytes(await jpegBytes(), 'https://example.com/download?id=1', {
      requireExtensionMatch: false,
    });
    expect(ingested.extension).toBe('avif');
  });

  it('keeps a local hash character as part of the file name', async () => {
    const ingested = await ingestMediaBytes(await jpegBytes(), '/photos/Family#1920.jpg');
    expect(ingested.extension).toBe('avif');
  });

  it('classifies remote content types', () => {
    expect(isAllowedRemoteMediaType('image/jpeg')).toBe(true);
    expect(isAllowedRemoteMediaType('image/pjpeg')).toBe(true);
    expect(isAllowedRemoteMediaType('image/avif')).toBe(true);
    expect(isAllowedRemoteMediaType('application/octet-stream')).toBe(true);
    expect(isAllowedRemoteMediaType(undefined)).toBe(true);
    expect(isAllowedRemoteMediaType('text/html')).toBe(false);
    expect(isAllowedRemoteMediaType('application/pdf')).toBe(false);
    expect(isAllowedRemoteMediaType('image/png')).toBe(false);
  });

  it('reads and stores local files under a generated AVIF name', async () => {
    const dir = await makeTempDir();
    const source = join(dir, 'Family Portrait.jpg');
    await writeFile(source, await jpegBytes());

    const ingested = await ingestMediaFile(source);
    const mediaDir = join(dir, 'media');
    await mkdir(mediaDir);
    const stored = await storeIngestedMedia(mediaDir, ingested);

    const hash = createHash('sha256').update(ingested.bytes).digest('hex').slice(0, 32);
    expect(stored.name).toBe(`${hash}.avif`);
    expect(stored.created).toBe(true);
    expect((await readFile(join(mediaDir, stored.name))).length).toBeGreaterThan(0);
  });

  it('deduplicates identical content under one hash name', async () => {
    const dir = await makeTempDir();
    const mediaDir = join(dir, 'media');
    await mkdir(mediaDir);

    const first = await ingestMediaBytes(await jpegBytes(), 'portrait.jpg');
    const copy = await ingestMediaBytes(await jpegBytes(), 'copy-of-portrait.jpg');
    const stored = await storeIngestedMedia(mediaDir, first);
    expect(stored.created).toBe(true);
    const duplicate = await storeIngestedMedia(mediaDir, copy);
    expect(duplicate).toEqual({ name: stored.name, created: false });
    expect(await storeIngestedMedia(mediaDir, first)).toEqual({ name: stored.name, created: false });
    expect(await readdir(mediaDir)).toEqual([stored.name]);

    const other = await ingestMediaBytes(await jpegBytes(9, 7), 'other.jpg');
    const otherStored = await storeIngestedMedia(mediaDir, other);
    expect(otherStored.name).not.toBe(stored.name);
    expect(otherStored.created).toBe(true);
    expect(await readdir(mediaDir)).toHaveLength(2);
  });

  it('surfaces the rejection reason', () => {
    const error = new MediaIngestError('unsupported-format');
    expect(error.name).toBe('MediaIngestError');
    expect(error.reason).toBe('unsupported-format');
  });
});
