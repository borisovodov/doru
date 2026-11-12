import type { MediaRecord } from '@doru/core';

export interface MediaWithPath extends MediaRecord {
  absolutePath: string;
}

export type CardAction = 'child' | 'spouse' | 'parent' | 'edit' | 'delete';

export interface PersonCounts {
  notes: number;
  sources: number;
  media: number;
}
