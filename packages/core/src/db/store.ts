import { DatabaseSync } from 'node:sqlite';
import { DORU_APPLICATION_ID, SCHEMA_SQL, SCHEMA_VERSION } from './schema';

export interface ITreeStore {
  readonly path: string;
  readonly db: DatabaseSync;
  userVersion(): number;
  close(): void;
}

export class TreeStore implements ITreeStore {
  readonly db: DatabaseSync;

  private constructor(
    db: DatabaseSync,
    readonly path: string,
  ) {
    this.db = db;
  }

  static open(path: string): TreeStore {
    const db = new DatabaseSync(path);
    // The GUI, MCP server helpers and ACP agents can all hold the same file
    // open at once; queue the quick writes below instead of failing instantly
    // with SQLITE_BUSY ("database is locked") when another process is
    // mid-write.
    db.exec('PRAGMA busy_timeout = 5000');
    const applicationId = (db.prepare('PRAGMA application_id').get() as { application_id: number }).application_id;
    if (applicationId !== DORU_APPLICATION_ID) {
      db.exec(`PRAGMA application_id = ${DORU_APPLICATION_ID}`);
    }
    const journalMode = (db.prepare('PRAGMA journal_mode').get() as { journal_mode: string }).journal_mode;
    if (journalMode !== 'delete') {
      db.exec('PRAGMA journal_mode = DELETE');
    }
    db.exec('PRAGMA foreign_keys = ON');
    const version = (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
    if (version < SCHEMA_VERSION) {
      db.exec(SCHEMA_SQL);
      db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    }
    return new TreeStore(db, path);
  }

  userVersion(): number {
    return (this.db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
  }

  close(): void {
    this.db.close();
  }
}

export interface TreeStoreFactory {
  open(path: string): ITreeStore;
}
