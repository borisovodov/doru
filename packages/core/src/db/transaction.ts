import type { DatabaseSync } from 'node:sqlite';

/**
 * Reentrant transaction guard shared by the repository facade and the
 * per-entity repositories. SQLite cannot nest BEGIN, so nested calls simply
 * execute inside the outer transaction.
 */
export class TransactionScope {
  private depth = 0;

  constructor(private readonly db: DatabaseSync) {}

  run<T>(fn: () => T): T {
    if (this.depth > 0) {
      return fn();
    }
    this.db.exec('BEGIN IMMEDIATE');
    this.depth = 1;
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    } finally {
      this.depth = 0;
    }
  }
}
