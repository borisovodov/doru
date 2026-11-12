import type { DatabaseSync } from 'node:sqlite';
import type { NoteLinkRecord, NoteRecord } from '../model/types';

interface NoteRow {
  id: string;
  xref: string | null;
  text: string;
  mime: string | null;
  language: string | null;
}

interface LinkRow {
  id: string;
  note_id: string;
  target_type: string;
  target_id: string;
}

/**
 * Notes with their link rows. An inline note has one link, a shared note
 * several. The flat `targetType`/`targetId` on the model are projections of
 * the first link (of the matching link, for per-target reads).
 */
export class NoteRepo {
  constructor(private readonly db: DatabaseSync) {}

  /** Inserts the note with its links (or the flat target as a single link). */
  insertNote(note: NoteRecord): void {
    this.insertRow(note);
    this.replaceLinks(note);
    this.replaceTranslations(note);
  }

  /** Updates the note text and translations; links are managed separately. */
  updateNote(note: NoteRecord): void {
    this.db
      .prepare('UPDATE note SET xref = ?, text = ?, mime = ?, language = ? WHERE id = ?')
      .run(note.xref ?? null, note.text, note.mime ?? null, note.language ?? null, note.id);
    this.replaceTranslations(note);
  }

  deleteNote(id: string): boolean {
    return this.db.prepare('DELETE FROM note WHERE id = ?').run(id).changes > 0;
  }

  addNoteLink(noteId: string, link: NoteLinkRecord): void {
    this.db
      .prepare('INSERT INTO note_link (id, note_id, target_type, target_id) VALUES (?, ?, ?, ?)')
      .run(link.id, noteId, link.targetType, link.targetId);
  }

  removeNoteLink(id: string): boolean {
    const link = this.db.prepare('SELECT note_id FROM note_link WHERE id = ?').get(id) as
      { note_id: string } | undefined;
    const result = this.db.prepare('DELETE FROM note_link WHERE id = ?').run(id);
    if (result.changes > 0 && link) {
      const remaining = this.db.prepare('SELECT COUNT(*) AS n FROM note_link WHERE note_id = ?').get(link.note_id) as {
        n: number;
      };
      if (remaining.n === 0) {
        this.db.prepare('DELETE FROM note WHERE id = ?').run(link.note_id);
      }
    }
    return result.changes > 0;
  }

  getNote(id: string): NoteRecord | undefined {
    const row = this.db.prepare('SELECT id, xref, text, mime, language FROM note WHERE id = ?').get(id) as
      NoteRow | undefined;
    return row ? this.hydrate(row) : undefined;
  }

  /** Every note, projected to its first link. */
  listNotes(): NoteRecord[] {
    const rows = this.db
      .prepare('SELECT id, xref, text, mime, language FROM note ORDER BY id')
      .all() as unknown as NoteRow[];
    return rows.map((row) => this.hydrate(row));
  }

  /** Notes linked to the target, projected to that target. */
  listNotesFor(targetType: string, targetId: string): NoteRecord[] {
    const links = this.db
      .prepare(
        'SELECT id, note_id, target_type, target_id FROM note_link WHERE target_type = ? AND target_id = ? ORDER BY id',
      )
      .all(targetType, targetId) as unknown as LinkRow[];
    const notes: NoteRecord[] = [];
    for (const link of links) {
      const row = this.db.prepare('SELECT id, xref, text, mime, language FROM note WHERE id = ?').get(link.note_id) as
        NoteRow | undefined;
      if (row) {
        notes.push({ ...this.hydrate(row), targetType, targetId });
      }
    }
    return notes;
  }

  /** The link rows targeting the given target, with their notes. */
  listLinksFor(targetType: string, targetId: string): Array<{ note: NoteRecord; link: NoteLinkRecord }> {
    const links = this.db
      .prepare('SELECT id, note_id, target_type, target_id FROM note_link WHERE target_type = ? AND target_id = ?')
      .all(targetType, targetId) as unknown as LinkRow[];
    const result: Array<{ note: NoteRecord; link: NoteLinkRecord }> = [];
    for (const link of links) {
      const row = this.db.prepare('SELECT id, xref, text, mime, language FROM note WHERE id = ?').get(link.note_id) as
        NoteRow | undefined;
      if (row) {
        result.push({
          note: this.hydrate(row),
          link: { id: link.id, targetType: link.target_type, targetId: link.target_id },
        });
      }
    }
    return result;
  }

  /** Removes every link to the target, deleting notes left with no links. */
  deleteLinksFor(targetType: string, targetId: string): void {
    const links = this.db
      .prepare('SELECT id, note_id FROM note_link WHERE target_type = ? AND target_id = ?')
      .all(targetType, targetId) as unknown as { id: string; note_id: string }[];
    this.db.prepare('DELETE FROM note_link WHERE target_type = ? AND target_id = ?').run(targetType, targetId);
    for (const link of links) {
      const remaining = this.db.prepare('SELECT COUNT(*) AS n FROM note_link WHERE note_id = ?').get(link.note_id) as {
        n: number;
      };
      if (remaining.n === 0) {
        this.db.prepare('DELETE FROM note WHERE id = ?').run(link.note_id);
      }
    }
  }

  private insertRow(note: NoteRecord): void {
    this.db
      .prepare('INSERT INTO note (id, xref, text, mime, language) VALUES (?, ?, ?, ?, ?)')
      .run(note.id, note.xref ?? null, note.text, note.mime ?? null, note.language ?? null);
  }

  private replaceLinks(note: NoteRecord): void {
    if (note.links !== undefined) {
      for (const link of note.links) {
        this.addNoteLink(note.id, link);
      }
    } else if (note.targetType !== undefined && note.targetId !== undefined) {
      this.addNoteLink(note.id, { id: crypto.randomUUID(), targetType: note.targetType, targetId: note.targetId });
    }
  }

  private replaceTranslations(note: NoteRecord): void {
    this.db.prepare('DELETE FROM note_translation WHERE note_id = ?').run(note.id);
    const insert = this.db.prepare(
      'INSERT INTO note_translation (id, note_id, text, mime, language) VALUES (?, ?, ?, ?, ?)',
    );
    for (const translation of note.translations ?? []) {
      insert.run(translation.id, note.id, translation.text, translation.mime ?? null, translation.language ?? null);
    }
  }

  private hydrate(row: NoteRow): NoteRecord {
    const links = this.db
      .prepare('SELECT id, note_id, target_type, target_id FROM note_link WHERE note_id = ? ORDER BY id')
      .all(row.id) as unknown as LinkRow[];
    const translations = this.db
      .prepare('SELECT id, text, mime, language FROM note_translation WHERE note_id = ? ORDER BY id')
      .all(row.id) as unknown as { id: string; text: string; mime: string | null; language: string | null }[];
    const first = links[0];
    const note: NoteRecord = {
      id: row.id,
      xref: row.xref ?? undefined,
      text: row.text,
      mime: row.mime ?? undefined,
      language: row.language ?? undefined,
      targetType: first?.target_type,
      targetId: first?.target_id,
      links: links.map((link) => ({ id: link.id, targetType: link.target_type, targetId: link.target_id })),
    };
    if (translations.length > 0) {
      note.translations = translations.map((translation) => ({
        id: translation.id,
        text: translation.text,
        mime: translation.mime ?? undefined,
        language: translation.language ?? undefined,
      }));
    }
    return note;
  }
}
