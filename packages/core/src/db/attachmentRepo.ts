import type { DatabaseSync } from 'node:sqlite';
import type { ContactRecord, IdentifierRecord } from '../model/types';

/**
 * The universal attachment tables: identifiers and contacts, both sharing
 * the polymorphic `(target_type, target_id)` shape.
 */
export class AttachmentRepo {
  constructor(private readonly db: DatabaseSync) {}

  // identifiers -------------------------------------------------------------

  insertIdentifier(identifier: IdentifierRecord): void {
    this.db
      .prepare('INSERT INTO identifier (id, target_type, target_id, namespace, type, value) VALUES (?, ?, ?, ?, ?, ?)')
      .run(
        identifier.id,
        identifier.targetType,
        identifier.targetId,
        identifier.namespace,
        identifier.type ?? null,
        identifier.value,
      );
  }

  deleteIdentifier(id: string): boolean {
    return this.db.prepare('DELETE FROM identifier WHERE id = ?').run(id).changes > 0;
  }

  updateIdentifier(identifier: IdentifierRecord): void {
    this.db
      .prepare('UPDATE identifier SET target_type = ?, target_id = ?, namespace = ?, type = ?, value = ? WHERE id = ?')
      .run(
        identifier.targetType,
        identifier.targetId,
        identifier.namespace,
        identifier.type ?? null,
        identifier.value,
        identifier.id,
      );
  }

  listIdentifiersFor(targetType: string, targetId: string): IdentifierRecord[] {
    const rows = this.db
      .prepare(
        'SELECT id, target_type, target_id, namespace, type, value FROM identifier WHERE target_type = ? AND target_id = ? ORDER BY id',
      )
      .all(targetType, targetId) as unknown as {
      id: string;
      target_type: string;
      target_id: string;
      namespace: string;
      type: string | null;
      value: string;
    }[];
    return rows.map((row) => ({
      id: row.id,
      targetType: row.target_type,
      targetId: row.target_id,
      namespace: row.namespace,
      ...(row.type !== null ? { type: row.type } : {}),
      value: row.value,
    }));
  }

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

  /** Deletes every attachment row of the target (except notes/citations/media, which own their links). */
  deleteAllFor(targetType: string, targetId: string): void {
    for (const table of ['identifier', 'contact'] as const) {
      this.db.prepare(`DELETE FROM ${table} WHERE target_type = ? AND target_id = ?`).run(targetType, targetId);
    }
  }
}
