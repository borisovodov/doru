import { describe, expect, it, vi } from 'vitest';
import { downloadRemoteMedia, isDownloadableMediaUrl, remoteMediaExtension } from '../src/main/mediaDownload';

function response(body: Uint8Array | null, init: ResponseInit = {}): Response {
  return new Response(body === null ? null : (body.buffer as ArrayBuffer), init);
}

describe('remote media downloader', () => {
  it('downloads an allowed HTTP file', async () => {
    const fetchMock = vi.fn(async () =>
      response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      }),
    ) as unknown as typeof fetch;

    const downloaded = await downloadRemoteMedia('http://93.184.216.34/photo.jpg', { fetch: fetchMock });
    expect([...downloaded.bytes]).toEqual([1, 2, 3]);
    expect(downloaded.contentType).toBe('image/jpeg');
    expect(downloaded.finalUrl).toBe('http://93.184.216.34/photo.jpg');
  });

  it('rejects local and private hosts before fetching', async () => {
    const fetchMock = vi.fn() as unknown as typeof fetch;
    await expect(downloadRemoteMedia('http://127.0.0.1/photo.jpg', { fetch: fetchMock })).rejects.toThrow(
      /private or local/,
    );
    await expect(downloadRemoteMedia('http://192.168.1.2/photo.jpg', { fetch: fetchMock })).rejects.toThrow(
      /private or local/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('enforces the byte limit', async () => {
    const fetchMock = vi.fn(async () =>
      response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      }),
    ) as unknown as typeof fetch;

    await expect(
      downloadRemoteMedia('http://93.184.216.34/photo.jpg', { fetch: fetchMock, maxBytes: 2 }),
    ).rejects.toThrow(/size limit/);
  });

  it('follows redirects and reports the final URL', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(null, { status: 302, headers: { location: '/second.jpg' } }))
      .mockResolvedValueOnce(
        response(new Uint8Array([9]), { status: 200, headers: { 'content-type': 'image/jpeg' } }),
      ) as unknown as typeof fetch;

    const downloaded = await downloadRemoteMedia('http://93.184.216.34/first.jpg', { fetch: fetchMock });
    expect(downloaded.finalUrl).toBe('http://93.184.216.34/second.jpg');
    expect([...downloaded.bytes]).toEqual([9]);
  });

  it('classifies downloadable URLs and chooses safe extensions', () => {
    expect(isDownloadableMediaUrl('https://example.com/a.jpg')).toBe(true);
    expect(isDownloadableMediaUrl('ftp://example.com/a.jpg')).toBe(false);
    expect(isDownloadableMediaUrl('file:///tmp/a.jpg')).toBe(false);
    expect(remoteMediaExtension('image/jpeg', 'https://example.com/no-extension')).toBe('.jpg');
    expect(remoteMediaExtension(undefined, 'https://example.com/a.oga?token=1')).toBe('.oga');
    expect(remoteMediaExtension(undefined, 'https://example.com/no-extension')).toBe('.bin');
  });
});
