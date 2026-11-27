import { open, stat } from 'node:fs/promises';
import { extname } from 'node:path';
import sharp from 'sharp';

/**
 * Technical facts derived from the file itself. They are never stored in
 * the database: a replaced or moved file simply reports new facts.
 */
export interface MediaFileFacts {
  mime: string;
  size?: number | undefined;
  width?: number | undefined;
  height?: number | undefined;
}

const MIME_BY_EXTENSION = new Map<string, string>([
  ['avif', 'image/avif'],
  ['bmp', 'image/bmp'],
  ['gif', 'image/gif'],
  ['heic', 'image/heic'],
  ['jpeg', 'image/jpeg'],
  ['jpg', 'image/jpeg'],
  ['mp3', 'audio/mpeg'],
  ['mp4', 'video/mp4'],
  ['ogg', 'audio/ogg'],
  ['pdf', 'application/pdf'],
  ['png', 'image/png'],
  ['svg', 'image/svg+xml'],
  ['tif', 'image/tiff'],
  ['tiff', 'image/tiff'],
  ['txt', 'text/plain'],
  ['wav', 'audio/wav'],
  ['webm', 'video/webm'],
  ['webp', 'image/webp'],
]);

export function mimeForPath(path: string): string {
  const extension = extname(path).slice(1).toLowerCase();
  return MIME_BY_EXTENSION.get(extension) ?? 'application/octet-stream';
}

/** Reads the file facts; a missing or unreadable file reports only its MIME. */
export async function readMediaFileFacts(absolutePath: string): Promise<MediaFileFacts> {
  const facts: MediaFileFacts = { mime: mimeForPath(absolutePath) };
  try {
    const info = await stat(absolutePath);
    facts.size = info.size;
    if (!info.isFile()) {
      return facts;
    }
    const dimensions = await readImageDimensions(absolutePath, facts.mime);
    if (dimensions !== undefined) {
      facts.width = dimensions.width;
      facts.height = dimensions.height;
    }
  } catch {
    // External or deleted file: the MIME is still useful, the rest is unknown.
  }
  return facts;
}

/**
 * Reads only the header bytes needed for image dimensions. Electron's
 * nativeImage would decode the whole picture, which is too expensive for a
 * list of thumbnails.
 */
async function readImageDimensions(
  absolutePath: string,
  mime: string,
): Promise<{ width: number; height: number } | undefined> {
  if (mime === 'image/avif') {
    try {
      const metadata = await sharp(absolutePath).metadata();
      const { width, height } = metadata.autoOrient;
      if (width > 0 && height > 0) {
        return { width, height };
      }
    } catch {
      // An unreadable AVIF has no dimensions; the MIME and size still count.
    }
    return undefined;
  }
  const handle = await open(absolutePath, 'r');
  try {
    const buffer = Buffer.alloc(262_144);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead < 10) {
      return undefined;
    }
    const bytes = buffer.subarray(0, bytesRead);
    return pngDimensions(bytes) ?? gifDimensions(bytes) ?? jpegDimensions(bytes) ?? webpDimensions(bytes);
  } finally {
    await handle.close();
  }
}

function pngDimensions(bytes: Buffer): { width: number; height: number } | undefined {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || signature.some((value, index) => bytes[index] !== value)) {
    return undefined;
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function gifDimensions(bytes: Buffer): { width: number; height: number } | undefined {
  if (bytes.length < 10) {
    return undefined;
  }
  const header = bytes.toString('ascii', 0, 6);
  if (header !== 'GIF87a' && header !== 'GIF89a') {
    return undefined;
  }
  return { width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) };
}

function jpegDimensions(bytes: Buffer): { width: number; height: number } | undefined {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return undefined;
  }
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    let markerOffset = offset + 1;
    while (bytes[markerOffset] === 0xff) {
      markerOffset += 1;
    }
    const marker = bytes[markerOffset];
    if (marker === undefined) {
      return undefined;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset = markerOffset + 1;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) {
      return undefined;
    }
    const length = bytes.readUInt16BE(markerOffset + 1);
    if (length < 2) {
      return undefined;
    }
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { width: bytes.readUInt16BE(markerOffset + 6), height: bytes.readUInt16BE(markerOffset + 4) };
    }
    offset = markerOffset + 1 + length;
  }
  return undefined;
}

function webpDimensions(bytes: Buffer): { width: number; height: number } | undefined {
  if (bytes.length < 30 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') {
    return undefined;
  }
  const chunk = bytes.toString('ascii', 12, 16);
  if (chunk === 'VP8X') {
    return {
      width: 1 + bytes.readUIntLE(24, 3),
      height: 1 + bytes.readUIntLE(27, 3),
    };
  }
  if (chunk === 'VP8L') {
    const bits = bytes.readUInt32LE(21);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
  }
  if (chunk === 'VP8 ') {
    return {
      width: bytes.readUInt16LE(26) & 0x3fff,
      height: bytes.readUInt16LE(28) & 0x3fff,
    };
  }
  return undefined;
}
