import { DatabaseSync } from 'node:sqlite';
import { DORU_APPLICATION_ID, SCHEMA_SQL, SCHEMA_VERSION } from './schema';

export interface ITreeStore {
  readonly path: string;
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
    db.exec(`PRAGMA application_id = ${DORU_APPLICATION_ID}`);
    db.exec('PRAGMA journal_mode = DELETE');
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
