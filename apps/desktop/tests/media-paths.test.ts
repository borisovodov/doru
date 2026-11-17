import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveMediaPath } from '../src/main/mediaPaths';

const projectDir = '/tmp/doru-project';

describe('resolveMediaPath', () => {
  it('accepts files inside the media folder', () => {
    expect(resolveMediaPath(projectDir, 'media/photo.jpg')).toBe(join(projectDir, 'media/photo.jpg'));
    expect(resolveMediaPath(projectDir, 'media/sub/../photo.jpg')).toBe(join(projectDir, 'media/photo.jpg'));
  });

  it('rejects the media folder itself and anything outside it', () => {
    expect(resolveMediaPath(projectDir, 'media/..')).toBeNull();
    expect(resolveMediaPath(projectDir, 'media/../tree.doru')).toBeNull();
    expect(resolveMediaPath(projectDir, '../outside.jpg')).toBeNull();
    expect(resolveMediaPath(projectDir, '/etc/passwd')).toBeNull();
  });
});
