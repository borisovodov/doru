// Resumable model download with integrity verification. Downloads to
// `<destination>.part` and only renames it into place after the size and the
// SHA-256 both match — a destination file that exists is always complete and
// verified. Interrupted downloads (network error, app quit, user cancel)
// leave the .part file behind and the next attempt resumes it via HTTP Range.
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { rename, rm, stat, statfs } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export type ModelDownloadErrorCode = 'http' | 'size-mismatch' | 'sha256-mismatch' | 'disk-space' | 'aborted';

export class ModelDownloadError extends Error {
  constructor(
    readonly code: ModelDownloadErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ModelDownloadError';
  }
}

export interface ModelDownloadOptions {
  url: string;
  /** Final file path; the download uses `<destination>.part` underneath. */
  destination: string;
  expectedSize: number;
  expectedSha256: string;
  /** Reports bytes downloaded so far (including a resumed prefix). */
  onProgress?: (downloadedBytes: number, totalBytes: number) => void;
  /** Aborts the download; the partial file stays for resuming. */
  signal?: AbortSignal;
}

async function fileSize(path: string): Promise<number> {
  try {
    return (await stat(path)).size;
  } catch {
    return 0;
  }
}

async function freeBytes(directory: string): Promise<number> {
  const info = await statfs(directory);
  return info.bavail * info.bsize;
}

async function sha256File(path: string): Promise<string> {
  const hash = createHash('sha256');
  const stream = createReadStream(path);
  for await (const chunk of stream) {
    hash.update(chunk as Buffer);
  }
  return hash.digest('hex');
}

/** Verifies an existing (partial) file and renames it into place if complete. */
async function verifyExisting(part: string, destination: string, expectedSize: number, expectedSha256: string): Promise<boolean> {
  if ((await fileSize(part)) !== expectedSize) {
    return false;
  }
  const digest = await sha256File(part);
  if (digest !== expectedSha256) {
    await rm(part, { force: true });
    return false;
  }
  await rename(part, destination);
  return true;
}

export async function downloadModel(options: ModelDownloadOptions): Promise<void> {
  const { url, destination, expectedSize, expectedSha256, onProgress, signal } = options;
  const part = `${destination}.part`;

  // A completed previous attempt (or a finished file renamed in flight).
  if (await fileSize(destination) === expectedSize) {
    return;
  }

  let existing = await fileSize(part);
  if (existing > expectedSize) {
    // A corrupt or superseded partial: start over.
    await rm(part, { force: true });
    existing = 0;
  }
  if (existing === expectedSize && (await verifyExisting(part, destination, expectedSize, expectedSha256))) {
    return;
  }

  const needed = expectedSize - existing;
  const free = await freeBytes(dirname(destination));
  if (free < needed) {
    throw new ModelDownloadError('disk-space', `Need ${needed} more bytes, ${free} free`);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers: existing > 0 ? { range: `bytes=${existing}-` } : {},
      ...(signal !== undefined ? { signal } : {}),
    });
  } catch (error) {
    if (signal?.aborted === true) {
      throw new ModelDownloadError('aborted', 'Download cancelled');
    }
    throw error;
  }
  if (!response.ok) {
    // 416 means the partial already covers the file — verify and finish.
    if (response.status === 416 && (await verifyExisting(part, destination, expectedSize, expectedSha256))) {
      return;
    }
    throw new ModelDownloadError('http', `Download failed: HTTP ${response.status}`);
  }
  if (response.body === null) {
    throw new ModelDownloadError('http', 'Download failed: empty response body');
  }

  let received = existing;
  if (response.status === 200) {
    // The server ignored the Range header: restart from scratch.
    await rm(part, { force: true });
    received = 0;
  } else if (response.status !== 206) {
    throw new ModelDownloadError('http', `Download failed: unexpected HTTP ${response.status}`);
  }

  const file = createWriteStream(part, { flags: received === 0 ? 'w' : 'a' });
  const progress = new Transform({
    transform(chunk, _encoding, callback) {
      received += (chunk as Buffer).length;
      onProgress?.(received, expectedSize);
      callback(null, chunk);
    },
  });
  try {
    await pipeline(
      Readable.fromWeb(response.body as unknown as import('node:stream/web').ReadableStream),
      progress,
      file,
    );
  } catch (error) {
    if (signal?.aborted === true) {
      throw new ModelDownloadError('aborted', 'Download cancelled');
    }
    throw error;
  }

  const finalSize = await fileSize(part);
  if (finalSize !== expectedSize) {
    throw new ModelDownloadError('size-mismatch', `Downloaded ${finalSize} bytes, expected ${expectedSize}`);
  }
  const digest = await sha256File(part);
  if (digest !== expectedSha256) {
    // Corrupted bytes are not worth resuming; drop them so a retry restarts.
    await rm(part, { force: true });
    throw new ModelDownloadError('sha256-mismatch', `SHA-256 mismatch: got ${digest}`);
  }
  await rename(part, destination);
}
