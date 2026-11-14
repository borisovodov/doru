import type { MediaFile, MediaRecord } from '@doru/core';

export interface MediaFileWithPath extends MediaFile {
  absolutePath: string;
}

export interface MediaWithPath extends Omit<MediaRecord, 'files'> {
  /** Absolute path of the first file, for the compact preview. */
  absolutePath: string;
  files?: MediaFileWithPath[] | undefined;
}

export type CardAction = 'child' | 'spouse' | 'parent' | 'edit' | 'delete';

export interface PersonCounts {
  notes: number;
  sources: number;
  media: number;
}
