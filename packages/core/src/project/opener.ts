import { join } from 'node:path';
import type { IFileSystem } from '../fs';
import type { ITreeStore, TreeStoreFactory } from '../db/store';
import {
  DEFAULT_SETTINGS,
  DEFAULT_THEME_CSS,
  HISTORY_FILE_NAME,
  PROJECT_DIRS,
  SETTINGS_FILE_NAME,
  THEME_FILE_NAME,
  TREE_FILE_NAME,
} from './layout';

export interface ProjectLogger {
  info(message: string, ...args: unknown[]): void;
}

export interface ProjectSummary {
  path: string;
  treePath: string;
  schemaVersion: number;
  created: string[];
  healed: string[];
}

export interface OpenedProject {
  summary: ProjectSummary;
  store: ITreeStore;
}

export class ProjectOpener {
  constructor(
    private readonly fs: IFileSystem,
    private readonly stores: TreeStoreFactory,
    private readonly logger?: ProjectLogger,
  ) {}

  async open(folderPath: string): Promise<OpenedProject> {
    await this.fs.mkdir(folderPath);
    const entries = (await this.fs.exists(folderPath)) ? await this.fs.readdir(folderPath) : [];
    const treeFile = this.findTreeFile(entries);
    const treePath = join(folderPath, treeFile);
    const isNewProject = entries.length === 0;

    const created: string[] = [];
    const healed: string[] = [];
    const target = isNewProject ? created : healed;

    if (!(await this.fs.exists(treePath))) {
      target.push(treeFile);
    }

    for (const dir of PROJECT_DIRS) {
      if (!(await this.fs.exists(join(folderPath, dir)))) {
        await this.fs.mkdir(join(folderPath, dir));
        target.push(`${dir}/`);
      }
    }

    for (const [name, content] of [
      [SETTINGS_FILE_NAME, DEFAULT_SETTINGS],
      [THEME_FILE_NAME, DEFAULT_THEME_CSS],
      [HISTORY_FILE_NAME, ''],
    ] as const) {
      const path = join(folderPath, name);
      if (!(await this.fs.exists(path))) {
        await this.fs.writeFile(path, content);
        target.push(name);
      }
    }

    const store = this.stores.open(treePath);
    const summary: ProjectSummary = {
      path: folderPath,
      treePath,
      schemaVersion: store.userVersion(),
      created,
      healed,
    };
    this.logger?.info('project opened', summary);
    return { summary, store };
  }

  private findTreeFile(entries: string[]): string {
    const candidates = entries
      .filter((entry) => entry.endsWith('.doru') && !entry.startsWith('.'))
      .sort();
    return candidates[0] ?? TREE_FILE_NAME;
  }
}
