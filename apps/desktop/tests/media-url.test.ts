import { describe, expect, it, vi } from 'vitest';
import { MediaIngestError } from '../src/main/mediaIngest';
import { fetchRemoteMedia, RemoteMediaError } from '../src/main/mediaUrl';

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
});
