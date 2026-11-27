import { randomUUID } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
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
  listAllMedia(): MediaRecord[];
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
 * Stores an ingested image in a project-scoped media folder and creates its
 * media record. A failed database insert removes the file only when this call
 * created it, no other record references it, and no other add is pending.
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
  let stored: Awaited<ReturnType<typeof storeIngestedMedia>>;
  try {
    stored = await storeIngestedMedia(mediaDir, ingested);
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
  let failed = false;
  let failure: unknown;
  try {
    service.addMedia(media);
  } catch (error) {
    failed = true;
    failure = error;
  }
  unmarkPending(mediaPath);
  if (failed) {
    if (stored.created && !isMediaPathPending(mediaPath)) {
      let referenced = true;
      try {
        const normalizedPath = normalizeMediaPath(mediaPath);
        referenced = service.listAllMedia().some((entry) => normalizeMediaPath(entry.path) === normalizedPath);
      } catch {
        // Never delete a file when its references cannot be verified.
      }
      if (!referenced) {
        await rm(join(mediaDir, name), { force: true }).catch(() => undefined);
      }
    }
    throw failure;
  }
  return media;
}
