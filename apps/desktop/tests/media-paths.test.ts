import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveImportFile, resolveMediaPath } from '../src/main/mediaPaths';

let projectDir = '';
let temp = '';

beforeEach(() => {
  temp = mkdtempSync(join(tmpdir(), 'doru-media-path-'));
  projectDir = join(temp, 'project');
  mkdirSync(join(projectDir, 'media'), { recursive: true });
});

afterEach(() => {
  if (temp !== '') {
    rmSync(temp, { recursive: true, force: true });
    temp = '';
  }
});

describe('resolveImportFile', () => {
  it('accepts only paths inside the GEDCOM source folder', async () => {
    const sourceDir = join(temp, 'gedcom');
    mkdirSync(sourceDir);
    expect(await resolveImportFile(sourceDir, join(sourceDir, 'photo.jpg'))).not.toBeNull();
    expect(await resolveImportFile(sourceDir, join(sourceDir, 'sub/../photo.jpg'))).not.toBeNull();
    expect(await resolveImportFile(sourceDir, join(temp, 'outside.jpg'))).toBeNull();
    expect(await resolveImportFile(sourceDir, join(sourceDir, '../outside.jpg'))).toBeNull();
    expect(await resolveImportFile(sourceDir, '/etc/passwd')).toBeNull();
  });

  it.skipIf(process.platform === 'win32')('rejects symlinks that leave the source folder', async () => {
    const sourceDir = join(temp, 'gedcom');
    mkdirSync(sourceDir);
    const outside = join(temp, 'outside');
    mkdirSync(outside);
    symlinkSync(outside, join(sourceDir, 'linked'));
    expect(await resolveImportFile(sourceDir, join(sourceDir, 'linked/photo.jpg'))).toBeNull();
  });
});

describe('resolveMediaPath', () => {
  it('accepts files inside the media folder and normalizes separators', async () => {
    const slash = await resolveMediaPath(projectDir, 'media/photo.jpg');
    const backslash = await resolveMediaPath(projectDir, 'media\\photo.jpg');
    expect(slash).not.toBeNull();
    expect(slash).toMatch(/doru-media-path-[^\\/]+[\\/]project[\\/]media[\\/]photo\.jpg$/);
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
    const outside = join(temp, 'outside');
    mkdirSync(outside);
    symlinkSync(outside, join(projectDir, 'media', 'linked'));
    expect(await resolveMediaPath(projectDir, 'media/linked/photo.jpg')).toBeNull();
  });
});
