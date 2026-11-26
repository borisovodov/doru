import type { DatabaseSync } from 'node:sqlite';
import type { ContactRecord } from '../model/types';

/**
 * The universal attachment table: contacts, sharing the polymorphic
 * `(target_type, target_id)` shape.
 */
export class AttachmentRepo {
  constructor(private readonly db: DatabaseSync) {}

  // contacts ----------------------------------------------------------------

  insertContact(contact: ContactRecord): void {
    this.db
      .prepare('INSERT INTO contact (id, target_type, target_id, kind, value) VALUES (?, ?, ?, ?, ?)')
      .run(contact.id, contact.targetType, contact.targetId, contact.kind, contact.value);
  }

  deleteContact(id: string): boolean {
    return this.db.prepare('DELETE FROM contact WHERE id = ?').run(id).changes > 0;
  }

  updateContact(contact: ContactRecord): void {
    this.db
      .prepare('UPDATE contact SET target_type = ?, target_id = ?, kind = ?, value = ? WHERE id = ?')
      .run(contact.targetType, contact.targetId, contact.kind, contact.value, contact.id);
  }

  listContactsFor(targetType: string, targetId: string): ContactRecord[] {
    const rows = this.db
      .prepare(
        'SELECT id, target_type, target_id, kind, value FROM contact WHERE target_type = ? AND target_id = ? ORDER BY id',
      )
      .all(targetType, targetId) as unknown as {
      id: string;
      target_type: string;
      target_id: string;
      kind: string;
      value: string;
    }[];
    return rows.map((row) => ({
      id: row.id,
      targetType: row.target_type,
      targetId: row.target_id,
      kind: row.kind,
      value: row.value,
    }));
  }

  // bulk cascade -------------------------------------------------------------

  /** Deletes the attachment rows that are not cleaned by their owning repo (identifiers, contacts). */
  deleteAllFor(targetType: string, targetId: string): void {
    this.db.prepare('DELETE FROM contact WHERE target_type = ? AND target_id = ?').run(targetType, targetId);
  }
}
