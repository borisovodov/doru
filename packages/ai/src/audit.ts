import type { IFileSystem } from '@doru/core';

export interface AuditEntry {
  ts: string;
  actor: string;
  opId: string;
  opKind: string;
  promptHash?: string;
}

export class HistoryLog {
  constructor(
    private readonly fs: IFileSystem,
    private readonly path: string,
  ) {}

  async append(entry: AuditEntry): Promise<void> {
    await this.fs.appendFile(this.path, `${JSON.stringify(entry)}\n`);
  }
}
