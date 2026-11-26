import { lookup } from 'node:dns/promises';
import type { LookupFunction } from 'node:net';
import { isIP } from 'node:net';
import { Agent, fetch as undiciFetch } from 'undici';

interface PinnedAddress {
  address: string;
  family: 4 | 6;
}

interface PinnedHost {
  addresses: PinnedAddress[];
}

type FetchLike = (input: URL, init?: RequestInit & { dispatcher?: Agent | undefined }) => Promise<Response>;

export interface DownloadedMedia {
  bytes: Uint8Array;
  contentType?: string | undefined;
  finalUrl: string;
}

export interface RemoteMediaOptions {
  /** Injectable for tests. */
  fetch?: typeof fetch | undefined;
  timeoutMs?: number | undefined;
  maxBytes?: number | undefined;
  maxRedirects?: number | undefined;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_BYTES = 100 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 5;

const MIME_EXTENSIONS = new Map<string, string>([
  ['application/pdf', '.pdf'],
  ['audio/mpeg', '.mp3'],
  ['audio/mp3', '.mp3'],
  ['audio/ogg', '.ogg'],
  ['audio/wav', '.wav'],
  ['audio/x-wav', '.wav'],
  ['image/gif', '.gif'],
  ['image/heic', '.heic'],
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/svg+xml', '.svg'],
  ['image/tiff', '.tiff'],
  ['image/webp', '.webp'],
  ['text/plain', '.txt'],
  ['video/mp4', '.mp4'],
  ['video/webm', '.webm'],
]);

/** True for external URL schemes that are never local project files. */
export function isExternalMediaUrl(value: string): boolean {
  return /^(?:https?|ftp|file):\/\//i.test(value.replaceAll('\\', '/'));
}

/** True for URLs this importer is allowed to download. */
export function isDownloadableMediaUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** A safe file extension for a downloaded file; always starts with a dot. */
export function remoteMediaExtension(contentType: string | undefined, url: string): string {
  const mime = contentType?.split(';')[0]?.trim().toLowerCase();
  const byMime = mime !== undefined ? MIME_EXTENSIONS.get(mime) : undefined;
  if (byMime !== undefined) {
    return byMime;
  }
  try {
    const pathname = new URL(url).pathname;
    const dot = pathname.lastIndexOf('.');
    const extension = dot === -1 ? '' : pathname.slice(dot + 1).toLowerCase();
    if (/^[a-z0-9]{1,8}$/.test(extension)) {
      return `.${extension}`;
    }
  } catch {
    // Fall through to the binary extension.
  }
  return '.bin';
}

function ipv4Parts(address: string): number[] | undefined {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return undefined;
  }
  return parts;
}

function isPrivateIPv4(address: string): boolean {
  const parts = ipv4Parts(address);
  if (parts === undefined) {
    return false;
  }
  const [a, b, c] = parts as [number, number, number, number];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, '');
  const family = isIP(normalized);
  if (family === 4) {
    return isPrivateIPv4(normalized);
  }
  if (family !== 6) {
    return true;
  }
  if (normalized === '::' || normalized === '::1') {
    return true;
  }
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized);
  if (mapped?.[1] !== undefined) {
    return isPrivateIPv4(mapped[1]);
  }
  const mappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(normalized);
  if (mappedHex?.[1] !== undefined && mappedHex[2] !== undefined) {
    const high = Number.parseInt(mappedHex[1], 16);
    const low = Number.parseInt(mappedHex[2], 16);
    return isPrivateIPv4(`${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`);
  }
  if (/^f[cd][0-9a-f]{2}:/.test(normalized)) {
    return true;
  }
  if (/^fe[89ab][0-9a-f]:/.test(normalized)) {
    return true;
  }
  if (/^ff[0-9a-f]{2}:/.test(normalized)) {
    return true;
  }
  return false;
}

function timeoutError(): Error {
  return new Error('remote media download timed out');
}

function raceWithSignal<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(timeoutError());
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => reject(timeoutError());
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

async function resolvePublicHost(hostname: string, signal: AbortSignal): Promise<PinnedHost> {
  const host = hostname.replace(/^\[|\]$/g, '');
  const literalFamily = isIP(host);
  if (literalFamily !== 0) {
    if (isPrivateAddress(host)) {
      throw new Error('remote media host is a private or local address');
    }
    return { addresses: [{ address: host, family: literalFamily === 4 ? 4 : 6 }] };
  }
  // The OS resolver is separate from fetch, so the download deadline must
  // cover the lookup as well as the request and response body.
  const addresses = await raceWithSignal(lookup(host, { all: true, order: 'verbatim' }), signal);
  if (addresses.length === 0) {
    throw new Error('remote media host did not resolve');
  }
  for (const entry of addresses) {
    if (isPrivateAddress(entry.address)) {
      throw new Error('remote media host resolves to a private or local address');
    }
  }
  return {
    addresses: addresses.map((entry) => ({
      address: entry.address,
      family: entry.family === 4 ? 4 : 6,
    })),
  };
}

function pinnedLookup(pinned: PinnedHost): LookupFunction {
  return (_hostname, options, callback) => {
    if (options.all === true) {
      callback(null, pinned.addresses);
      return;
    }
    const first = pinned.addresses[0];
    if (first === undefined) {
      const error: NodeJS.ErrnoException = new Error('remote media host did not resolve');
      callback(error, '', 0);
      return;
    }
    callback(null, first.address, first.family);
  };
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

/**
 * Downloads one remote media file with hard limits. No consent UI and no
 * progress reporting live here; the caller decides how to surface failures.
 */
export async function downloadRemoteMedia(value: string, options: RemoteMediaOptions = {}): Promise<DownloadedMedia> {
  const fetchImpl = (options.fetch ?? undiciFetch) as unknown as FetchLike;
  const pinDownloads = options.fetch === undefined;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  // One deadline per file, redirects included.
  const signal = AbortSignal.timeout(timeoutMs);

  let current: URL;
  try {
    current = new URL(value);
  } catch {
    throw new Error('remote media URL is malformed');
  }

  for (let redirects = 0; ; redirects += 1) {
    if (current.protocol !== 'http:' && current.protocol !== 'https:') {
      throw new Error('remote media URL uses an unsupported protocol');
    }
    const pinned = await resolvePublicHost(current.hostname, signal);
    if (signal.aborted) {
      throw timeoutError();
    }
    const agent = pinDownloads
      ? new Agent({
          connect: {
            lookup: pinnedLookup(pinned),
          },
        })
      : undefined;

    try {
      const response = await fetchImpl(current, {
        redirect: 'manual',
        signal,
        ...(agent !== undefined ? { dispatcher: agent } : {}),
      });

      if (isRedirect(response.status)) {
        if (redirects >= maxRedirects) {
          throw new Error('remote media URL redirected too many times');
        }
        const location = response.headers.get('location');
        if (location === null || location === '') {
          throw new Error('remote media redirect has no location');
        }
        await response.body?.cancel();
        current = new URL(location, current);
        continue;
      }

      if (!response.ok) {
        throw new Error(`remote media download failed with HTTP ${response.status}`);
      }
      if (response.body === null) {
        throw new Error('remote media download returned an empty body');
      }

      const contentLength = Number(response.headers.get('content-length') ?? '');
      if (Number.isFinite(contentLength) && contentLength > maxBytes) {
        throw new Error('remote media file exceeds the size limit');
      }

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { done, value: chunk } = await reader.read();
        if (done) {
          break;
        }
        total += chunk.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          throw new Error('remote media file exceeds the size limit');
        }
        chunks.push(chunk);
      }

      const bytes = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
      return {
        bytes,
        ...(contentType !== undefined && contentType !== '' ? { contentType } : {}),
        finalUrl: current.toString(),
      };
    } finally {
      // `destroy` also tears down connections whose response body was left
      // unread by an error path, so a failed download cannot hang the import.
      await agent?.destroy();
    }
  }
}
