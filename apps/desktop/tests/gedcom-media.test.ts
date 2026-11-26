import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseGedcom70, type GedcomDataset } from '@doru/gedcom';
import { prepareGedcomMedia, type GedcomMediaLogger } from '../src/main/gedcom';

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

function makeLogger(): GedcomMediaLogger {
  return { info: vi.fn(), warn: vi.fn() };
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
      logger: makeLogger(),
    });

    const mapped = paths.get(url);
    expect(mapped).toMatch(/^media\/[0-9a-f-]+\.jpg$/);
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
      logger: makeLogger(),
    });

    expect(download).toHaveBeenCalledTimes(5);
    expect(paths.size).toBe(5);
  });

  it('keeps the URL as an external reference when the download fails', async () => {
    const dir = await makeTempDir();
    const logger = makeLogger();
    const download = vi.fn(async () => {
      throw new Error('HTTP 404');
    });

    const paths = await prepareGedcomMedia(
      datasetWithFiles(['https://example.com/missing.jpg']),
      undefined,
      join(dir, 'tree.ged'),
      dir,
      { download, logger },
    );

    expect(paths.size).toBe(0);
    expect(logger.warn).toHaveBeenCalledWith(
      'gedcom import: could not download media URL',
      expect.stringContaining('example.com'),
      expect.any(Error),
    );
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
        logger: makeLogger(),
      }),
    ).rejects.toThrow('disk full');
  });
});
