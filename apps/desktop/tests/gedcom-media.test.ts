import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseGedcom70, type GedcomDataset } from '@doru/gedcom';
import { prepareGedcomMedia } from '../src/main/gedcom';
import { MediaIngestError } from '../src/main/mediaIngest';
import type { RemoteMediaOptions } from '../src/main/mediaDownload';

const encoder = new TextEncoder();
const tempDirs: string[] = [];

function datasetWithFiles(files: string[]): GedcomDataset {
  const lines = ['0 HEAD', '1 GEDC', '2 VERS 7.0'];
  for (const [index, file] of files.entries()) {
    lines.push(`0 @O${index + 1}@ OBJE`, `1 FILE ${file}`);
  }
  lines.push('0 TRLR');
  const parsed = parseGedcom70(encoder.encode(lines.join('\n')));
  if (!parsed.ok) {
    throw new Error(JSON.stringify(parsed));
  }
  return parsed.value;
}

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn() };
}

/** Skips real AVIF encoding; the ingest pipeline has its own tests. */
const acceptMedia = async (bytes: Uint8Array) => ({ bytes, extension: 'avif' as const });

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'doru-gedcom-media-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('prepareGedcomMedia', () => {
  it('downloads a remote file, stores it under media/ and maps the URL', async () => {
    const dir = await makeTempDir();
    const url = 'https://example.com/photo.jpg';
    const download = vi.fn(async () => ({
      bytes: new Uint8Array([1, 2, 3]),
      contentType: 'image/jpeg',
      finalUrl: url,
    }));

    const paths = await prepareGedcomMedia(datasetWithFiles([url]), undefined, join(dir, 'tree.ged'), dir, {
      download,
      ingest: acceptMedia,
      logger: makeLogger(),
    });

    const mapped = paths.get(url);
    expect(mapped).toMatch(/^media\/[0-9a-f-]+\.avif$/);
    expect([...(await readFile(join(dir, mapped ?? '')))]).toEqual([1, 2, 3]);
    expect(download).toHaveBeenCalledWith(url, expect.objectContaining({ maxBytes: expect.any(Number) }));
  });

  it('stops after the total byte budget is reserved', async () => {
    const dir = await makeTempDir();
    const urls = Array.from({ length: 7 }, (_, index) => `https://example.com/${index}.jpg`);
    const download = vi.fn(async (url: string) => ({
      bytes: { byteLength: 100 * 1024 * 1024 } as unknown as Uint8Array,
      finalUrl: url,
    }));

    const paths = await prepareGedcomMedia(datasetWithFiles(urls), undefined, join(dir, 'tree.ged'), dir, {
      download,
      write: vi.fn(async () => undefined),
      ingest: acceptMedia,
      logger: makeLogger(),
    });

    expect(download).toHaveBeenCalledTimes(5);
    expect(paths.size).toBe(5);
  });

  it('retries URLs that only failed the budget check because of reservations', async () => {
    const dir = await makeTempDir();
    const sizes = [100, 100, 1, 1, 1, 1, 1].map((megabytes) => megabytes * 1024 * 1024);
    const urls = sizes.map((_, index) => `https://example.com/${index}.jpg`);
    const download = vi.fn(async (url: string) => {
      const index = urls.indexOf(url);
      return {
        bytes: { byteLength: sizes[index] ?? 0 } as unknown as Uint8Array,
        finalUrl: url,
      };
    });

    const paths = await prepareGedcomMedia(datasetWithFiles(urls), undefined, join(dir, 'tree.ged'), dir, {
      download,
      write: vi.fn(async () => undefined),
      ingest: acceptMedia,
      logger: makeLogger(),
    });

    expect(download).toHaveBeenCalledTimes(7);
    expect(paths.size).toBe(7);
  });

  it('waits for a full per-file cap instead of starting with the partial remainder', async () => {
    const dir = await makeTempDir();
    const sizes = [100, 99, 1, 1, 1, 50].map((megabytes) => megabytes * 1024 * 1024);
    const urls = sizes.map((_, index) => `https://example.com/${index}.jpg`);
    const pending = sizes.map(() => deferred());
    const download = vi.fn(async (url: string, options?: RemoteMediaOptions) => {
      const index = urls.indexOf(url);
      const size = sizes[index] ?? 0;
      if (size > (options?.maxBytes ?? size)) {
        throw new Error('remote media file exceeds the size limit');
      }
      await pending[index]?.promise;
      return {
        bytes: { byteLength: size } as unknown as Uint8Array,
        finalUrl: url,
      };
    });

    const result = prepareGedcomMedia(datasetWithFiles(urls), undefined, join(dir, 'tree.ged'), dir, {
      download,
      write: vi.fn(async () => undefined),
      ingest: acceptMedia,
      logger: makeLogger(),
    });

    // Four workers start, each reserving 100 MiB.
    await vi.waitFor(() => expect(download).toHaveBeenCalledTimes(4));
    pending[0]?.resolve();
    // The 100 MiB file frees a full slot, so the fifth download starts.
    await vi.waitFor(() => expect(download).toHaveBeenCalledTimes(5));
    pending[1]?.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    // Only 1 MiB is free while three reservations remain: the 50 MiB file
    // must wait instead of starting with a 1 MiB cap.
    expect(download).toHaveBeenCalledTimes(5);
    pending[2]?.resolve();
    await vi.waitFor(() => expect(download).toHaveBeenCalledTimes(6));

    for (const entry of pending) {
      entry.resolve();
    }
    const paths = await result;
    expect(paths.size).toBe(6);
  });

  it('skips URLs that fail to download and does not log credentials', async () => {
    const dir = await makeTempDir();
    const logger = makeLogger();
    const download = vi.fn(async () => {
      throw new Error('https://user:supersecret@example.com/missing.jpg?token=secret');
    });

    const paths = await prepareGedcomMedia(
      datasetWithFiles(['https://example.com/missing.jpg']),
      undefined,
      join(dir, 'tree.ged'),
      dir,
      { download, ingest: acceptMedia, logger },
    );

    expect(paths.size).toBe(0);
    expect(logger.warn).toHaveBeenCalledWith(
      'gedcom import: could not download media URL',
      expect.stringContaining('example.com'),
      'download failed',
    );
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('secret');
  });

  it('skips remote media with a non-image content type', async () => {
    const dir = await makeTempDir();
    const logger = makeLogger();
    const url = 'https://example.com/page';
    const download = vi.fn(async () => ({
      bytes: new Uint8Array([1, 2, 3]),
      contentType: 'text/html',
      finalUrl: url,
    }));

    const paths = await prepareGedcomMedia(datasetWithFiles([url]), undefined, join(dir, 'tree.ged'), dir, {
      download,
      ingest: acceptMedia,
      logger,
    });

    expect(paths.size).toBe(0);
    expect(logger.warn).toHaveBeenCalledWith('gedcom import: skipped unsupported media type', 'https://example.com/…');
  });

  it('skips remote media rejected by the ingest pipeline', async () => {
    const dir = await makeTempDir();
    const logger = makeLogger();
    const url = 'https://example.com/photo.jpg';
    const download = vi.fn(async () => ({
      bytes: new Uint8Array([1, 2, 3]),
      contentType: 'image/jpeg',
      finalUrl: url,
    }));
    const ingest = vi.fn(async () => {
      throw new MediaIngestError('unsupported-format');
    });

    const paths = await prepareGedcomMedia(datasetWithFiles([url]), undefined, join(dir, 'tree.ged'), dir, {
      download,
      ingest,
      logger,
    });

    expect(paths.size).toBe(0);
    expect(logger.warn).toHaveBeenCalledWith(
      'gedcom import: skipped unsupported media',
      'https://example.com/…',
      'unsupported-format',
    );
  });

  it('converts a local image beside the GEDCOM', async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, 'photo.jpg'), Buffer.from([0xff, 0xd8, 0xff]));

    const paths = await prepareGedcomMedia(datasetWithFiles(['photo.jpg']), undefined, join(dir, 'tree.ged'), dir, {
      download: vi.fn(),
      ingest: acceptMedia,
      logger: makeLogger(),
    });

    expect(paths.get('photo.jpg')).toMatch(/^media\/[0-9a-f-]+\.avif$/);
  });

  it('does not copy local files beside a GEDZIP that does not bundle them', async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, 'secret.txt'), 'secret');

    const paths = await prepareGedcomMedia(datasetWithFiles(['secret.txt']), [], join(dir, 'tree.gdz'), dir, {
      download: vi.fn(),
      ingest: acceptMedia,
      logger: makeLogger(),
    });

    expect(paths.size).toBe(0);
  });

  it('drains active downloads before rejecting a project-write failure', async () => {
    const dir = await makeTempDir();
    const urls = Array.from({ length: 8 }, (_, index) => `https://example.com/${index}.jpg`);
    let started = 0;
    let completed = 0;
    const download = vi.fn(async (url: string) => {
      started += 1;
      await Promise.resolve();
      completed += 1;
      return { bytes: new Uint8Array([1]), contentType: 'image/jpeg', finalUrl: url };
    });
    const write = vi.fn(async () => {
      throw new Error('disk full');
    });

    await expect(
      prepareGedcomMedia(datasetWithFiles(urls), undefined, join(dir, 'tree.ged'), dir, {
        download,
        write,
        ingest: acceptMedia,
        logger: makeLogger(),
      }),
    ).rejects.toThrow('disk full');

    expect(started).toBe(4);
    expect(completed).toBe(4);
  });

  it('propagates project-write failures instead of treating them as download failures', async () => {
    const dir = await makeTempDir();
    const url = 'https://example.com/photo.jpg';
    const download = vi.fn(async () => ({
      bytes: new Uint8Array([1]),
      contentType: 'image/jpeg',
      finalUrl: url,
    }));
    const write = vi.fn(async () => {
      throw new Error('disk full');
    });

    await expect(
      prepareGedcomMedia(datasetWithFiles([url]), undefined, join(dir, 'tree.ged'), dir, {
        download,
        write,
        ingest: acceptMedia,
        logger: makeLogger(),
      }),
    ).rejects.toThrow('disk full');
  });
});
