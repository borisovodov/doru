import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { MEDIA_DIR_NAME } from '@doru/core';

/**
 * Resolves a stored media path under the project's media folder. Returns
 * null for anything that resolves to the media folder itself or outside it.
 */
export function resolveMediaPath(projectDir: string, mediaPath: string): string | null {
  const mediaDir = join(projectDir, MEDIA_DIR_NAME);
  const absolute = resolve(projectDir, mediaPath);
  const relativePath = relative(mediaDir, absolute);
  if (relativePath === '' || relativePath === '..' || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    return null;
  }
  return absolute;
}
