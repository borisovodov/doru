import type { MediaRecord } from '@doru/core';

export interface MediaWithPath extends MediaRecord {
  absolutePath: string;
}
