import type { MediaFile, MediaRecord } from '@doru/core';

/** Technical facts derived from the file, never stored in the database. */
export interface MediaFileFacts {
  mime: string;
  size?: number | undefined;
  width?: number | undefined;
  height?: number | undefined;
}

export interface MediaFileWithPath extends MediaFile {
  absolutePath: string;
  facts?: MediaFileFacts | undefined;
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
