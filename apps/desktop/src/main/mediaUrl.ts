import { mediaTitleFromPath, normalizeMediaUrl } from '@doru/core';
import { downloadRemoteMedia } from './mediaDownload';
import { ingestMediaBytes, isAllowedRemoteMediaType, MediaIngestError, type IngestedMedia } from './mediaIngest';

export type RemoteMediaFailure = 'invalid-url' | 'download-failed' | 'unsupported-media' | 'too-large';

/** A failed URL add. The code is safe for logs and UI mapping. */
export class RemoteMediaError extends Error {
  readonly code: RemoteMediaFailure;

  constructor(code: RemoteMediaFailure) {
    super(code);
    this.name = 'RemoteMediaError';
    this.code = code;
  }
}

export interface RemoteMediaDependencies {
  download?: typeof downloadRemoteMedia | undefined;
  ingest?: typeof ingestMediaBytes | undefined;
}

export interface FetchedRemoteMedia {
  ingested: IngestedMedia;
  title?: string | undefined;
  finalUrl: string;
}

/**
 * Downloads a direct image URL and runs it through the same ingest policy as
 * local media. No record or project file is created here.
 */
export async function fetchRemoteMedia(
  value: string,
  dependencies: RemoteMediaDependencies = {},
): Promise<FetchedRemoteMedia> {
  const normalized = normalizeMediaUrl(value);
  if (normalized === undefined) {
    throw new RemoteMediaError('invalid-url');
  }
  const download = dependencies.download ?? downloadRemoteMedia;
  const ingest = dependencies.ingest ?? ingestMediaBytes;

  let downloaded: Awaited<ReturnType<typeof download>>;
  try {
    downloaded = await download(normalized);
  } catch {
    throw new RemoteMediaError('download-failed');
  }
  if (!isAllowedRemoteMediaType(downloaded.contentType)) {
    throw new RemoteMediaError('unsupported-media');
  }

  let ingested: IngestedMedia;
  try {
    ingested = await ingest(downloaded.bytes, downloaded.finalUrl, { requireExtensionMatch: false });
  } catch (error) {
    if (error instanceof MediaIngestError) {
      throw new RemoteMediaError(error.reason === 'too-large' ? 'too-large' : 'unsupported-media');
    }
    throw new RemoteMediaError('download-failed');
  }

  const title = mediaTitleFromPath(downloaded.finalUrl) ?? mediaTitleFromPath(normalized);
  return {
    ingested,
    ...(title !== undefined ? { title } : {}),
    finalUrl: downloaded.finalUrl,
  };
}
