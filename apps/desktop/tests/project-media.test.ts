import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { copyMediaDirectory } from '../src/main/projectMedia';

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'doru-project-media-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('copyMediaDirectory', () => {
  it('copies flat media and per-project scope directories', async () => {
    const source = await makeTempDir();
    const destination = join(await makeTempDir(), 'media');
    await writeFile(join(source, 'legacy.jpg'), 'legacy');
    await mkdir(join(source, 'scope-a'));
    await writeFile(join(source, 'scope-a', 'copy.avif'), 'nested');

    await copyMediaDirectory(source, destination);

    expect(await readFile(join(destination, 'legacy.jpg'), 'utf8')).toBe('legacy');
    expect(await readFile(join(destination, 'scope-a', 'copy.avif'), 'utf8')).toBe('nested');
    expect((await readdir(destination)).sort()).toEqual(['legacy.jpg', 'scope-a']);
  });
});
