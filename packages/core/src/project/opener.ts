import { dirname } from 'node:path';
import type { IFileSystem } from '../fs';
import type { ITreeStore, TreeStoreFactory } from '../db/store';

export interface ProjectLogger {
  info(message: string, ...args: unknown[]): void;
}

export interface ProjectSummary {
  /** Absolute path of the project's `.doru` file. */
  path: string;
  schemaVersion: number;
  /** Whether the file did not exist before this open. */
  created: boolean;
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

  async open(filePath: string): Promise<OpenedProject> {
    const parent = dirname(filePath);
    if (!(await this.fs.exists(parent))) {
      await this.fs.mkdir(parent);
    }
    const created = !(await this.fs.exists(filePath));
    const store = this.stores.open(filePath);
    const summary: ProjectSummary = {
      path: filePath,
      schemaVersion: store.userVersion(),
      created,
    };
    this.logger?.info('project opened', summary);
    return { summary, store };
  }
}
