import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { MEDIA_DIR_NAME, type MediaRecord } from '@doru/core';
import { storeIngestedMedia, type IngestedMedia } from './mediaIngest';

export interface MediaTarget {
  targetType: string;
  targetId: string;
}

/** The subset of the tree service used to add a media card. */
export interface MediaRecordService {
  addMedia(media: MediaRecord): unknown;
  listAllMedia(): MediaRecord[];
}

/**
 * Stores an ingested image and creates its media record. A failed database
 * insert removes the file only when this call created it and no other record
 * references it.
 */
export async function addStoredMedia(
  mediaDir: string,
  ingested: IngestedMedia,
  title: string | undefined,
  target: MediaTarget | undefined,
  service: MediaRecordService,
): Promise<MediaRecord> {
  const stored = await storeIngestedMedia(mediaDir, ingested);
  const media: MediaRecord = {
    id: randomUUID(),
    ...(title !== undefined ? { title } : {}),
    path: join(MEDIA_DIR_NAME, stored.name),
    ...(target !== undefined ? { targetType: target.targetType, targetId: target.targetId } : {}),
  };
  try {
    service.addMedia(media);
  } catch (error) {
    if (stored.created) {
      let referenced = true;
      try {
        const normalizedPath = media.path.replaceAll('\\', '/');
        referenced = service.listAllMedia().some((entry) => entry.path.replaceAll('\\', '/') === normalizedPath);
      } catch {
        // Never delete a file when its references cannot be verified.
      }
      if (!referenced) {
        await rm(join(mediaDir, stored.name), { force: true }).catch(() => undefined);
      }
    }
    throw error;
  }
  return media;
}
