import { describe, expect, it } from 'vitest';
import { RecentProjects } from '../src/project/recent';
import { MemoryFileSystem } from './helpers';

describe('RecentProjects', () => {
  it('returns an empty list when the store does not exist', async () => {
    const fs = new MemoryFileSystem();
    const recents = new RecentProjects(fs, '/data/recent.json');
    expect(await recents.list()).toEqual([]);
  });

  it('touches projects: newest first, deduplicated, capped', async () => {
    const fs = new MemoryFileSystem();
    const recents = new RecentProjects(fs, '/data/recent.json');

    await recents.touch('/projects/a');
    await recents.touch('/projects/b');
    await recents.touch('/projects/a');

    const list = await recents.list();
    expect(list.map((item) => item.path)).toEqual(['/projects/a', '/projects/b']);

    for (let i = 0; i < 12; i++) {
      await recents.touch(`/projects/p${i}`);
    }
    const capped = await recents.list();
    expect(capped).toHaveLength(RecentProjects.MAX_ENTRIES);
    expect(capped[0]?.path).toBe('/projects/p11');
  });

  it('stores and updates security-scoped bookmarks per entry', async () => {
    const fs = new MemoryFileSystem();
    const recents = new RecentProjects(fs, '/data/recent.json');

    await recents.touch('/projects/a', 'Ym9vaw==');
    await recents.touch('/projects/b');

    let list = await recents.list();
    expect(list.find((entry) => entry.path === '/projects/a')?.bookmark).toBe('Ym9vaw==');
    expect(list.find((entry) => entry.path === '/projects/b')?.bookmark).toBeUndefined();

    // A re-touch without a bookmark clears the stored one.
    await recents.touch('/projects/a');
    list = await recents.list();
    expect(list.find((entry) => entry.path === '/projects/a')?.bookmark).toBeUndefined();
  });

  it('survives a corrupt store file', async () => {
    const fs = new MemoryFileSystem();
    await fs.writeFile('/data/recent.json', '{not json');
    const recents = new RecentProjects(fs, '/data/recent.json');
    expect(await recents.list()).toEqual([]);
    expect((await recents.touch('/projects/a')).map((item) => item.path)).toEqual([
      '/projects/a',
    ]);
  });
});
