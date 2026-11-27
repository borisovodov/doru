import { describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import type { MediaRecord } from '@doru/core';
import { MediaIngestError } from '../src/main/mediaIngest';
import { addRemoteMediaRecord, fetchRemoteMedia, RemoteMediaError } from '../src/main/mediaUrl';

const bytes = new Uint8Array([1, 2, 3]);
const ingested = { bytes: new Uint8Array([4, 5, 6]), extension: 'avif' as const, width: 10, height: 10 };

function downloadMock(finalUrl: string, contentType: string | undefined = 'image/jpeg') {
  return vi.fn(async () => ({ bytes, contentType, finalUrl }));
}

const ingestMock = vi.fn(async () => ingested);

describe('remote media ingestion', () => {
  it('normalizes the link, downloads it and derives a title', async () => {
    const download = downloadMock('https://cdn.example.com/portrait.jpg');

    const result = await fetchRemoteMedia('example.com/photo.jpg', { download, ingest: ingestMock });

    expect(download).toHaveBeenCalledWith('https://example.com/photo.jpg');
    expect(ingestMock).toHaveBeenCalledWith(bytes, 'https://cdn.example.com/portrait.jpg', {
      requireExtensionMatch: false,
    });
    expect(result).toMatchObject({ ingested, title: 'portrait', finalUrl: 'https://cdn.example.com/portrait.jpg' });
  });

  it('rejects a non-image content type before decoding', async () => {
    const download = downloadMock('https://example.com/page', 'text/html');
    const ingest = vi.fn(async () => ingested);

    await expect(fetchRemoteMedia('https://example.com/page', { download, ingest })).rejects.toMatchObject({
      code: 'unsupported-media',
    });
    expect(ingest).not.toHaveBeenCalled();
  });

  it('reports download, invalid URL and ingest failures as stable codes', async () => {
    const download = vi.fn(async () => {
      throw new Error('network');
    });
    await expect(fetchRemoteMedia('https://example.com/a.jpg', { download })).rejects.toMatchObject({
      code: 'download-failed',
    });

    await expect(fetchRemoteMedia('ftp://example.com/a.jpg', { download, ingest: ingestMock })).rejects.toMatchObject({
      code: 'invalid-url',
    });

    const tooLarge = vi.fn(async () => {
      throw new MediaIngestError('too-large');
    });
    await expect(
      fetchRemoteMedia('https://example.com/a.jpg', {
        download: downloadMock('https://example.com/a.jpg'),
        ingest: tooLarge,
      }),
    ).rejects.toMatchObject({ code: 'too-large' });

    const unsupported = vi.fn(async () => {
      throw new MediaIngestError('unsupported-format');
    });
    await expect(
      fetchRemoteMedia('https://example.com/a.jpg', {
        download: downloadMock('https://example.com/a.jpg'),
        ingest: unsupported,
      }),
    ).rejects.toMatchObject({ code: 'unsupported-media' });
  });

  it('exposes a typed error', () => {
    const error = new RemoteMediaError('invalid-url');
    expect(error.name).toBe('RemoteMediaError');
    expect(error.code).toBe('invalid-url');
  });

  it('stores a fetched URL and creates a targeted media record', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'doru-remote-media-'));
    try {
      const records: MediaRecord[] = [];
      const service = {
        addMedia: (media: MediaRecord) => {
          records.push(media);
        },
        listAllMedia: () => records,
      };

      const media = await addRemoteMediaRecord(
        dir,
        'example.com/photo.jpg',
        { targetType: 'person', targetId: 'P1' },
        service,
        { download: downloadMock('https://cdn.example.com/portrait.jpg'), ingest: ingestMock },
      );

      expect(media.title).toBe('portrait');
      expect(media).toMatchObject({ targetType: 'person', targetId: 'P1' });
      expect(records).toEqual([media]);
      expect(await readFile(join(dir, basename(media.path)))).toEqual(Buffer.from(ingested.bytes));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
