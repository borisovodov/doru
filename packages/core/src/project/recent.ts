import { dirname } from 'node:path';
import type { IFileSystem } from '../fs';

export interface RecentProject {
  path: string;
  lastOpenedAt: string;
}

export class RecentProjects {
  static readonly MAX_ENTRIES = 10;

  constructor(
    private readonly fs: IFileSystem,
    private readonly file: string,
  ) {}

  async list(): Promise<RecentProject[]> {
    try {
      const text = await this.fs.readFile(this.file);
      const parsed = JSON.parse(text) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.filter(
        (item): item is RecentProject =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as RecentProject).path === 'string',
      );
    } catch {
      return [];
    }
  }

  async touch(path: string): Promise<RecentProject[]> {
    const current = (await this.list()).filter((item) => item.path !== path);
    const next = [{ path, lastOpenedAt: new Date().toISOString() }, ...current].slice(
      0,
      RecentProjects.MAX_ENTRIES,
    );
    await this.fs.mkdir(dirname(this.file));
    await this.fs.writeFile(this.file, `${JSON.stringify(next, null, 2)}\n`);
    return next;
  }
}
