import { createHash, randomUUID } from 'node:crypto';
import { readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { isExternalMediaPath } from '@doru/core/model';

/** Hard limits for every ingested image, local or remote. */
const MAX_INPUT_BYTES = 100 * 1024 * 1024;
const MAX_INPUT_PIXELS = 100_000_000;

/** AVIF settings for the stored copy. The original is never resized. */
const AVIF_QUALITY = 70;
const AVIF_EFFORT = 4;

export type MediaIngestReason =
  | 'unsupported-format'
  | 'extension-mismatch'
  | 'invalid-image'
  | 'too-large'
  | 'too-many-pixels'
  | 'animated';

/** A rejected media file. The reason is a stable code safe for logs. */
export class MediaIngestError extends Error {
  readonly reason: MediaIngestReason;

  constructor(reason: MediaIngestReason) {
    super(reason);
    this.name = 'MediaIngestError';
    this.reason = reason;
  }
}

export interface MediaIngestOptions {
  /** Require `.jpg`/`.jpeg` for JPEG and `.avif` for AVIF; URLs skip this. */
  requireExtensionMatch?: boolean | undefined;
  maxBytes?: number | undefined;
  maxPixels?: number | undefined;
}

export interface IngestedMedia {
  bytes: Uint8Array;
  extension: 'avif';
  width?: number | undefined;
  height?: number | undefined;
}

type MediaFormat = { kind: 'jpeg' } | { kind: 'avif'; animated: boolean };

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  let value = '';
  for (let index = 0; index < length; index += 1) {
    const byte = bytes[offset + index];
    if (byte === undefined) {
      return '';
    }
    value += String.fromCharCode(byte);
  }
  return value;
}

function uint32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) * 0x1000000 +
      (bytes[offset + 1] ?? 0) * 0x10000 +
      (bytes[offset + 2] ?? 0) * 0x100 +
      (bytes[offset + 3] ?? 0)) >>>
    0
  );
}

/**
 * Detects the two accepted formats from their signatures. The extension is
 * not consulted here: a renamed PDF or PNG must not pass as a JPEG.
 */
function detectFormat(bytes: Uint8Array): MediaFormat | undefined {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { kind: 'jpeg' };
  }
  if (bytes.length < 16 || ascii(bytes, 4, 4) !== 'ftyp') {
    return undefined;
  }
  const boxSize = uint32(bytes, 0);
  if (boxSize < 16 || boxSize > bytes.length) {
    return undefined;
  }
  const major = ascii(bytes, 8, 4);
  const brands = [major];
  for (let offset = 16; offset + 4 <= boxSize; offset += 4) {
    brands.push(ascii(bytes, offset, 4));
  }
  if (!brands.includes('avif') && !brands.includes('avis')) {
    return undefined;
  }
  return { kind: 'avif', animated: major === 'avis' || brands.includes('avis') };
}

/** The lower-case extension of a local path or URL, without query or fragment. */
function extensionOf(sourceName: string): string | undefined {
  const normalized = sourceName.replaceAll('\\', '/');
  const query = isExternalMediaPath(sourceName) ? normalized.search(/[?#]/) : -1;
  const withoutQuery = query === -1 ? normalized : normalized.slice(0, query);
  const segment = withoutQuery.slice(withoutQuery.lastIndexOf('/') + 1);
  const dot = segment.lastIndexOf('.');
  return dot > 0 ? segment.slice(dot + 1).toLowerCase() : undefined;
}

function expectedFormat(extension: string | undefined): MediaFormat['kind'] | undefined {
  if (extension === 'jpg' || extension === 'jpeg') {
    return 'jpeg';
  }
  if (extension === 'avif') {
    return 'avif';
  }
  return undefined;
}

function checkExtension(sourceName: string, format: MediaFormat): void {
  const extension = extensionOf(sourceName);
  if (expectedFormat(extension) !== format.kind) {
    throw new MediaIngestError('extension-mismatch');
  }
}

async function readDimensions(buffer: Buffer, maxPixels: number): Promise<{ width: number; height: number }> {
  try {
    const metadata = await sharp(buffer, { failOn: 'warning', limitInputPixels: false }).metadata();
    const { width, height } = metadata.autoOrient;
    if (width <= 0 || height <= 0) {
      throw new MediaIngestError('invalid-image');
    }
    if (width * height > maxPixels) {
      throw new MediaIngestError('too-many-pixels');
    }
    return { width, height };
  } catch (error) {
    if (error instanceof MediaIngestError) {
      throw error;
    }
    throw new MediaIngestError('invalid-image');
  }
}

/**
 * Validates one image and returns the bytes to store. JPEG is decoded,
 * auto-oriented and encoded as AVIF; AVIF is decoded for validation and kept
 * byte-for-byte. Everything outside JPEG/AVIF is rejected.
 */
export async function ingestMediaBytes(
  bytes: Uint8Array,
  sourceName: string,
  options: MediaIngestOptions = {},
): Promise<IngestedMedia> {
  const maxBytes = options.maxBytes ?? MAX_INPUT_BYTES;
  if (bytes.byteLength > maxBytes) {
    throw new MediaIngestError('too-large');
  }
  const format = detectFormat(bytes);
  if (format === undefined) {
    throw new MediaIngestError('unsupported-format');
  }
  if (format.kind === 'avif' && format.animated) {
    throw new MediaIngestError('animated');
  }
  if (options.requireExtensionMatch !== false) {
    checkExtension(sourceName, format);
  }

  const maxPixels = options.maxPixels ?? MAX_INPUT_PIXELS;
  const buffer = Buffer.from(bytes);
  let dimensions: { width: number; height: number };
  try {
    dimensions = await readDimensions(buffer, maxPixels);
    if (format.kind === 'avif') {
      // Decode the whole image once: a valid header alone must not let a
      // truncated or malicious payload into the project.
      await sharp(buffer, { failOn: 'warning', limitInputPixels: maxPixels }).stats();
      return { bytes, extension: 'avif', ...dimensions };
    }
    const output = await sharp(buffer, { failOn: 'warning', limitInputPixels: maxPixels })
      .rotate()
      .withMetadata({ orientation: 1 })
      .avif({ quality: AVIF_QUALITY, effort: AVIF_EFFORT })
      .toBuffer();
    return { bytes: output, extension: 'avif', ...dimensions };
  } catch (error) {
    if (error instanceof MediaIngestError) {
      throw error;
    }
    throw new MediaIngestError('invalid-image');
  }
}

/** Reads and validates a local file, enforcing the same byte and format limits. */
export async function ingestMediaFile(path: string, options: MediaIngestOptions = {}): Promise<IngestedMedia> {
  const info = await stat(path);
  if (!info.isFile()) {
    throw new MediaIngestError('unsupported-format');
  }
  if (info.size > (options.maxBytes ?? MAX_INPUT_BYTES)) {
    throw new MediaIngestError('too-large');
  }
  return ingestMediaBytes(await readFile(path), path, options);
}

/** The stored copy is always content-addressed by a SHA-256 prefix. */
const MEDIA_HASH_PREFIX_LENGTH = 32;

/**
 * The content-addressed name of a stored image: the first 32 hex characters
 * of SHA-256, plus `.avif`. Identical bytes always map to the same file.
 */
export function mediaContentName(bytes: Uint8Array): string {
  const hash = createHash('sha256').update(bytes).digest('hex');
  return `${hash.slice(0, MEDIA_HASH_PREFIX_LENGTH)}.avif`;
}

/** The per-project media namespace; projects in one folder stay isolated. */
export function mediaProjectScope(projectKey: string): string {
  return createHash('sha256').update(projectKey).digest('hex').slice(0, 16);
}

/** A stored media file and whether this call created it. */
export interface StoredMedia {
  name: string;
  created: boolean;
}

/**
 * Writes an ingested image under the project's media folder. An existing
 * content-addressed file with the same bytes is reused and reported as
 * `created: false`.
 */
export async function storeIngestedMedia(mediaDir: string, ingested: IngestedMedia): Promise<StoredMedia> {
  const name = mediaContentName(ingested.bytes);
  const destination = join(mediaDir, name);
  try {
    const existing = await stat(destination);
    if (existing.isFile() && existing.size === ingested.bytes.byteLength) {
      return { name, created: false };
    }
  } catch {
    // The file does not exist yet; write it below.
  }

  const temporary = `${destination}.tmp-${randomUUID()}`;
  try {
    await writeFile(temporary, ingested.bytes);
    try {
      await rename(temporary, destination);
    } catch (error) {
      // Windows refuses to replace an existing file. A racing writer may have
      // produced the same content; in that case the copy is already correct.
      const existing = await stat(destination).catch(() => undefined);
      if (existing?.isFile() === true && existing.size === ingested.bytes.byteLength) {
        await rm(temporary, { force: true });
        return { name, created: false };
      }
      throw error;
    }
    return { name, created: true };
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

const ALLOWED_REMOTE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/avif',
  'application/octet-stream',
  'binary/octet-stream',
]);

/**
 * Matches the Content-Type of a remote image. The bytes are validated
 * separately, so a generic octet-stream is accepted.
 */
export function isAllowedRemoteMediaType(contentType: string | undefined): boolean {
  if (contentType === undefined) {
    return true;
  }
  const mime = contentType.split(';')[0]?.trim().toLowerCase();
  return mime === undefined || mime === '' || ALLOWED_REMOTE_TYPES.has(mime);
}
