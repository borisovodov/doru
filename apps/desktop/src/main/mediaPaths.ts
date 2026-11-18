import { realpath } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { MEDIA_DIR_NAME } from '@doru/core';

/** True when `child` is a strict descendant of `parent`. */
function isInside(parent: string, child: string): boolean {
  const path = relative(parent, child);
  return path !== '' && path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

/** Canonicalizes an existing path; for a missing path, its deepest existing ancestor. */
async function canonicalPath(path: string): Promise<string> {
  const suffix: string[] = [];
  let current = path;
  for (;;) {
    try {
      const canonical = await realpath(current);
      return suffix.length === 0 ? canonical : join(canonical, ...suffix.reverse());
    } catch {
      const parent = dirname(current);
      if (parent === current) {
        return path;
      }
      suffix.push(basename(current));
      current = parent;
    }
  }
}

/**
 * Resolves a stored media path under the project's media folder. Returns
 * null for anything that resolves to the media folder itself or outside it,
 * including paths escaping through a symlink.
 */
export async function resolveMediaPath(projectDir: string, mediaPath: string): Promise<string | null> {
  const normalized = mediaPath.replaceAll('\\', '/');
  const mediaDir = join(projectDir, MEDIA_DIR_NAME);
  const absolute = resolve(projectDir, normalized);
  if (!isInside(mediaDir, absolute)) {
    return null;
  }
  const canonicalProject = await canonicalPath(projectDir);
  const canonicalMedia = await canonicalPath(mediaDir);
  if (!isInside(canonicalProject, canonicalMedia)) {
    return null;
  }
  const canonicalTarget = await canonicalPath(absolute);
  return isInside(canonicalMedia, canonicalTarget) ? canonicalTarget : null;
}
