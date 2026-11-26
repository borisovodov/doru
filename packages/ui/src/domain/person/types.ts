import type { MediaRecord } from '@doru/core';

/** Technical facts derived from the file, never stored in the database. */
export interface MediaFileFacts {
  mime: string;
  size?: number | undefined;
  width?: number | undefined;
  height?: number | undefined;
}

export interface MediaWithPath extends MediaRecord {
  /** Absolute path of the single file; empty for external/unresolved media. */
  absolutePath: string;
  facts?: MediaFileFacts | undefined;
}

export type CardAction = 'child' | 'spouse' | 'parent' | 'edit' | 'delete';

export interface PersonCounts {
  notes: number;
  sources: number;
  media: number;
}
