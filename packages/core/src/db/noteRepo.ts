import type { DatabaseSync } from 'node:sqlite';
import type { NoteRecord } from '../model/types';

interface NoteRow {
  id: string;
  text: string;
  target_type: string;
  target_id: string;
  created_at: number | null;
  updated_at: number | null;
}

/**
 * Notes owned by exactly one target. The polymorphic target pair lives on
 * the note row itself; shared GEDCOM notes are copied per target on import.
 */
export class NoteRepo {
  constructor(private readonly db: DatabaseSync) {}

  /** Inserts the note with its target. */
  insertNote(note: NoteRecord): void {
    this.db
      .prepare('INSERT INTO note (id, text, target_type, target_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(note.id, note.text, note.targetType, note.targetId, note.createdAt ?? null, note.updatedAt ?? null);
  }

  /** Updates the note text and timestamp; the target never changes. */
  updateNote(note: NoteRecord): void {
    if (this.db.prepare('SELECT 1 FROM note WHERE id = ?').get(note.id) === undefined) {
      throw new Error(`note ${note.id} no longer exists`);
    }
    this.db
      .prepare('UPDATE note SET text = ?, updated_at = ? WHERE id = ?')
      .run(note.text, note.updatedAt ?? null, note.id);
  }

  deleteNote(id: string): boolean {
    return this.db.prepare('DELETE FROM note WHERE id = ?').run(id).changes > 0;
  }

  getNote(id: string): NoteRecord | undefined {
    const row = this.db
      .prepare('SELECT id, text, target_type, target_id, created_at, updated_at FROM note WHERE id = ?')
      .get(id) as NoteRow | undefined;
    return row ? this.hydrate(row) : undefined;
  }

  /** Every note, ordered by id. */
  listNotes(): NoteRecord[] {
    const rows = this.db
      .prepare('SELECT id, text, target_type, target_id, created_at, updated_at FROM note ORDER BY id')
      .all() as unknown as NoteRow[];
    return rows.map((row) => this.hydrate(row));
  }

  /** Notes owned by the target, ordered by id. */
  listNotesFor(targetType: string, targetId: string): NoteRecord[] {
    const rows = this.db
      .prepare(
        `SELECT id, text, target_type, target_id, created_at, updated_at
         FROM note WHERE target_type = ? AND target_id = ? ORDER BY id`,
      )
      .all(targetType, targetId) as unknown as NoteRow[];
    return rows.map((row) => this.hydrate(row));
  }

  /** Deletes every note owned by the target. */
  deleteNotesFor(targetType: string, targetId: string): void {
    this.db.prepare('DELETE FROM note WHERE target_type = ? AND target_id = ?').run(targetType, targetId);
  }

  private hydrate(row: NoteRow): NoteRecord {
    return {
      id: row.id,
      text: row.text,
      targetType: row.target_type,
      targetId: row.target_id,
      createdAt: row.created_at ?? undefined,
      updatedAt: row.updated_at ?? undefined,
    };
  }
}
