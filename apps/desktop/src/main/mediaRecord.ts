import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { MEDIA_DIR_NAME, type MediaRecord } from '@doru/core';
import { mediaContentName, storeIngestedMedia, type IngestedMedia } from './mediaIngest';

export interface MediaTarget {
  targetType: string;
  targetId: string;
}

/** The subset of the tree service used to add a media card. */
export interface MediaRecordService {
  addMedia(media: MediaRecord): unknown;
}

/** Media paths with an add in flight, keyed by their normalized path. */
const pendingMediaPaths = new Map<string, number>();

function normalizeMediaPath(path: string): string {
  return path.replaceAll('\\', '/');
}

/** True while an add for this media path has not committed its record yet. */
export function isMediaPathPending(path: string): boolean {
  return pendingMediaPaths.has(normalizeMediaPath(path));
}

function markPending(path: string): void {
  const key = normalizeMediaPath(path);
  pendingMediaPaths.set(key, (pendingMediaPaths.get(key) ?? 0) + 1);
}

function unmarkPending(path: string): void {
  const key = normalizeMediaPath(path);
  const count = (pendingMediaPaths.get(key) ?? 0) - 1;
  if (count > 0) {
    pendingMediaPaths.set(key, count);
  } else {
    pendingMediaPaths.delete(key);
  }
}

/**
 * Stores an ingested image and creates its media record. The pending marker
 * covers storage and the record insert so a concurrent delete cannot remove
 * the file before the record commits. A failed insert keeps the stored copy;
 * another add may already be reusing the same content-addressed file.
 */
export async function addStoredMedia(
  mediaDir: string,
  ingested: IngestedMedia,
  title: string | undefined,
  target: MediaTarget | undefined,
  service: MediaRecordService,
): Promise<MediaRecord> {
  await mkdir(mediaDir, { recursive: true });
  const name = mediaContentName(ingested.bytes);
  const mediaPath = join(MEDIA_DIR_NAME, name);
  markPending(mediaPath);
  try {
    await storeIngestedMedia(mediaDir, ingested);
  } catch (error) {
    unmarkPending(mediaPath);
    throw error;
  }
  const media: MediaRecord = {
    id: randomUUID(),
    ...(title !== undefined ? { title } : {}),
    path: mediaPath,
    ...(target !== undefined ? { targetType: target.targetType, targetId: target.targetId } : {}),
  };
  try {
    service.addMedia(media);
  } catch (error) {
    unmarkPending(mediaPath);
    throw error;
  }
  unmarkPending(mediaPath);
  return media;
}
