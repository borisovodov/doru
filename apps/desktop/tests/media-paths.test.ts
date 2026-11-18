import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveMediaPath } from '../src/main/mediaPaths';

const projectDir = join(realpathSync(tmpdir()), 'doru-project');
let temp = '';

afterEach(() => {
  if (temp !== '') {
    rmSync(temp, { recursive: true, force: true });
    temp = '';
  }
});

describe('resolveMediaPath', () => {
  it('accepts files inside the media folder and normalizes separators', async () => {
    const slash = await resolveMediaPath(projectDir, 'media/photo.jpg');
    const backslash = await resolveMediaPath(projectDir, 'media\\photo.jpg');
    expect(slash).not.toBeNull();
    expect(slash).toMatch(/doru-project[\\/]media[\\/]photo\.jpg$/);
    expect(backslash).toBe(slash);
    expect(await resolveMediaPath(projectDir, 'media/sub/../photo.jpg')).toBe(slash);
  });

  it('rejects the media folder itself and anything outside it', async () => {
    expect(await resolveMediaPath(projectDir, 'media/..')).toBeNull();
    expect(await resolveMediaPath(projectDir, 'media/../tree.doru')).toBeNull();
    expect(await resolveMediaPath(projectDir, '../outside.jpg')).toBeNull();
    expect(await resolveMediaPath(projectDir, '/etc/passwd')).toBeNull();
  });

  it.skipIf(process.platform === 'win32')('rejects paths escaping through a symlink', async () => {
    temp = mkdtempSync(join(tmpdir(), 'doru-media-path-'));
    const project = join(temp, 'project');
    const outside = join(temp, 'outside');
    mkdirSync(join(project, 'media'), { recursive: true });
    mkdirSync(outside);
    symlinkSync(outside, join(project, 'media', 'linked'));
    expect(await resolveMediaPath(project, 'media/linked/photo.jpg')).toBeNull();
  });
});
