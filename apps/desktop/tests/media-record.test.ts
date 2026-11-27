import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { MediaRecord } from '@doru/core';
import { isProjectMediaPath } from '@doru/core/model';
import { addStoredMedia, type MediaRecordService } from '../src/main/mediaRecord';

const tempDirs: string[] = [];
const ingested = { bytes: new Uint8Array([1, 2, 3]), extension: 'avif' as const };

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'doru-media-record-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function serviceWith(records: MediaRecord[], fail: () => boolean): MediaRecordService {
  return {
    addMedia: (media) => {
      if (fail()) {
        throw new Error('database unavailable');
      }
      records.push(media);
      return undefined;
    },
    listAllMedia: () => records,
  };
}

describe('addStoredMedia', () => {
  it('stores the file and creates a media record with the target fields', async () => {
    const dir = await makeTempDir();
    const records: MediaRecord[] = [];
    const media = await addStoredMedia(
      dir,
      ingested,
      'Portrait',
      { targetType: 'person', targetId: 'P1' },
      serviceWith(records, () => false),
    );

    expect(isProjectMediaPath(media.path)).toBe(true);
    expect(basename(media.path)).toMatch(/^[0-9a-f]{32}\.avif$/);
    expect(media.title).toBe('Portrait');
    expect(media).toMatchObject({ targetType: 'person', targetId: 'P1' });
    expect(records).toEqual([media]);
    expect(await readFile(join(dir, basename(media.path)))).toEqual(Buffer.from(ingested.bytes));
  });

  it('reuses one content-addressed file for identical media', async () => {
    const dir = await makeTempDir();
    const records: MediaRecord[] = [];
    const service = serviceWith(records, () => false);
    const first = await addStoredMedia(dir, ingested, 'First', undefined, service);
    const second = await addStoredMedia(dir, ingested, 'Second', undefined, service);

    expect(second.path).toBe(first.path);
    expect(records).toHaveLength(2);
    expect(await readdir(dir)).toEqual([basename(first.path)]);
  });

  it('removes a newly created file when the record cannot be added', async () => {
    const dir = await makeTempDir();
    await expect(
      addStoredMedia(
        dir,
        ingested,
        undefined,
        undefined,
        serviceWith([], () => true),
      ),
    ).rejects.toThrow('database unavailable');
    expect(await readdir(dir)).toEqual([]);
  });

  it('keeps a shared file when a duplicate record cannot be added', async () => {
    const dir = await makeTempDir();
    const records: MediaRecord[] = [];
    let fail = false;
    const service: MediaRecordService = {
      addMedia: (media) => {
        if (fail) {
          throw new Error('database unavailable');
        }
        records.push(media);
        return undefined;
      },
      listAllMedia: () => records,
    };

    const first = await addStoredMedia(dir, ingested, 'First', undefined, service);
    fail = true;
    await expect(addStoredMedia(dir, ingested, 'Second', undefined, service)).rejects.toThrow('database unavailable');
    expect(await readdir(dir)).toEqual([basename(first.path)]);
  });

  it('keeps a new file when references cannot be checked after a failed insert', async () => {
    const dir = await makeTempDir();
    const service: MediaRecordService = {
      addMedia: () => {
        throw new Error('database unavailable');
      },
      listAllMedia: () => {
        throw new Error('database unavailable');
      },
    };

    await expect(addStoredMedia(dir, ingested, undefined, undefined, service)).rejects.toThrow('database unavailable');
    expect(await readdir(dir)).toHaveLength(1);
  });

  it('keeps a new file referenced through a forward-slash path', async () => {
    const dir = await makeTempDir();
    const hash = createHash('sha256').update(ingested.bytes).digest('hex').slice(0, 32);
    const existing = { id: 'M1', path: `media/${hash}.avif` };
    const service: MediaRecordService = {
      addMedia: () => {
        throw new Error('database unavailable');
      },
      listAllMedia: () => [existing],
    };

    await expect(addStoredMedia(dir, ingested, undefined, undefined, service)).rejects.toThrow('database unavailable');
    expect(await readdir(dir)).toEqual([`${hash}.avif`]);
  });
});
