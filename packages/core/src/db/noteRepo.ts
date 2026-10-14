import type { DatabaseSync } from 'node:sqlite';
import type { NoteRecord } from '../model/types';

export class NoteRepo {
  constructor(private readonly db: DatabaseSync) {}

  insertNote(note: NoteRecord): void {
    this.db
      .prepare('INSERT INTO note (id, text, target_type, target_id) VALUES (?, ?, ?, ?)')
      .run(note.id, note.text, note.targetType ?? null, note.targetId ?? null);
  }

  deleteNote(id: string): boolean {
    const result = this.db.prepare('DELETE FROM note WHERE id = ?').run(id);
    return result.changes > 0;
  }

  listNotes(): NoteRecord[] {
    const rows = this.db.prepare('SELECT id, text, target_type, target_id FROM note ORDER BY id').all() as unknown as {
      id: string;
      text: string;
      target_type: string | null;
      target_id: string | null;
    }[];
    return rows.map((row) => ({
      id: row.id,
      text: row.text,
      targetType: row.target_type ?? undefined,
      targetId: row.target_id ?? undefined,
    }));
  }
}
