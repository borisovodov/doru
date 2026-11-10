import type { DatabaseSync } from 'node:sqlite';
import type {
  ChangeRecord,
  ContactRecord,
  IdentifierRecord,
  RestrictionRecord,
  TagLinkRecord,
  TagRecord,
} from '../model/types';
import type { DateRepo } from './dateRepo';

/**
 * The universal attachment tables: identifiers, contacts, restrictions,
 * change log rows, tags and tag links — all sharing the polymorphic
 * `(target_type, target_id)` shape.
 */
export class AttachmentRepo {
  constructor(
    private readonly db: DatabaseSync,
    private readonly dates: DateRepo,
  ) {}

  // identifiers -------------------------------------------------------------

  insertIdentifier(identifier: IdentifierRecord): void {
    this.db
      .prepare('INSERT INTO identifier (id, target_type, target_id, namespace, value) VALUES (?, ?, ?, ?, ?)')
      .run(identifier.id, identifier.targetType, identifier.targetId, identifier.namespace, identifier.value);
  }

  deleteIdentifier(id: string): boolean {
    return this.db.prepare('DELETE FROM identifier WHERE id = ?').run(id).changes > 0;
  }

  listIdentifiersFor(targetType: string, targetId: string): IdentifierRecord[] {
    const rows = this.db
      .prepare('SELECT id, target_type, target_id, namespace, value FROM identifier WHERE target_type = ? AND target_id = ? ORDER BY id')
      .all(targetType, targetId) as unknown as {
      id: string;
      target_type: string;
      target_id: string;
      namespace: string;
      value: string;
    }[];
    return rows.map((row) => ({
      id: row.id,
      targetType: row.target_type,
      targetId: row.target_id,
      namespace: row.namespace,
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

  listContactsFor(targetType: string, targetId: string): ContactRecord[] {
    const rows = this.db
      .prepare('SELECT id, target_type, target_id, kind, value FROM contact WHERE target_type = ? AND target_id = ? ORDER BY id')
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

  // restrictions ------------------------------------------------------------

  insertRestriction(restriction: RestrictionRecord): void {
    this.db
      .prepare('INSERT INTO restriction (id, target_type, target_id, level) VALUES (?, ?, ?, ?)')
      .run(restriction.id, restriction.targetType, restriction.targetId, restriction.level);
  }

  deleteRestriction(id: string): boolean {
    return this.db.prepare('DELETE FROM restriction WHERE id = ?').run(id).changes > 0;
  }

  listRestrictionsFor(targetType: string, targetId: string): RestrictionRecord[] {
    const rows = this.db
      .prepare('SELECT id, target_type, target_id, level FROM restriction WHERE target_type = ? AND target_id = ? ORDER BY id')
      .all(targetType, targetId) as unknown as {
      id: string;
      target_type: string;
      target_id: string;
      level: string;
    }[];
    return rows.map((row) => ({
      id: row.id,
      targetType: row.target_type,
      targetId: row.target_id,
      level: row.level,
    }));
  }

  // change log --------------------------------------------------------------

  insertChange(change: ChangeRecord): void {
    const dateId = change.date ? this.dates.upsert(change.date) : null;
    this.db
      .prepare('INSERT INTO change (id, target_type, target_id, kind, date_id, user) VALUES (?, ?, ?, ?, ?, ?)')
      .run(change.id, change.targetType, change.targetId, change.kind, dateId, change.user ?? null);
  }

  deleteChange(id: string): boolean {
    const row = this.db.prepare('SELECT date_id FROM change WHERE id = ?').get(id) as
      | { date_id: string | null }
      | undefined;
    const result = this.db.prepare('DELETE FROM change WHERE id = ?').run(id);
    if (row?.date_id !== null && row?.date_id !== undefined) {
      this.dates.delete(row.date_id);
    }
    return result.changes > 0;
  }

  listChangesFor(targetType: string, targetId: string): ChangeRecord[] {
    const rows = this.db
      .prepare('SELECT id, target_type, target_id, kind, date_id, user FROM change WHERE target_type = ? AND target_id = ? ORDER BY id')
      .all(targetType, targetId) as unknown as {
      id: string;
      target_type: string;
      target_id: string;
      kind: string;
      date_id: string | null;
      user: string | null;
    }[];
    const datesById = this.dates.getMany(rows.map((row) => row.date_id).filter((id): id is string => id !== null));
    return rows.map((row) => ({
      id: row.id,
      targetType: row.target_type,
      targetId: row.target_id,
      kind: row.kind as ChangeRecord['kind'],
      date: row.date_id !== null ? datesById.get(row.date_id) : undefined,
      user: row.user ?? undefined,
    }));
  }

  // tags ---------------------------------------------------------------------

  insertTag(tag: TagRecord): void {
    this.db.prepare('INSERT INTO tag (id, name) VALUES (?, ?)').run(tag.id, tag.name);
  }

  deleteTag(id: string): boolean {
    return this.db.prepare('DELETE FROM tag WHERE id = ?').run(id).changes > 0;
  }

  listTags(): TagRecord[] {
    const rows = this.db.prepare('SELECT id, name FROM tag ORDER BY name').all() as unknown as {
      id: string;
      name: string;
    }[];
    return rows.map((row) => ({ id: row.id, name: row.name }));
  }

  insertTagLink(link: TagLinkRecord): void {
    const dateId = link.date ? this.dates.upsert(link.date) : null;
    this.db
      .prepare('INSERT INTO tag_link (id, tag_id, target_type, target_id, date_id) VALUES (?, ?, ?, ?, ?)')
      .run(link.id, link.tagId, link.targetType, link.targetId, dateId);
  }

  deleteTagLink(id: string): boolean {
    return this.db.prepare('DELETE FROM tag_link WHERE id = ?').run(id).changes > 0;
  }

  listTagLinksFor(targetType: string, targetId: string): Array<{ tagId: string; link: TagLinkRecord }> {
    const rows = this.db
      .prepare('SELECT id, tag_id, target_type, target_id, date_id FROM tag_link WHERE target_type = ? AND target_id = ? ORDER BY id')
      .all(targetType, targetId) as unknown as {
      id: string;
      tag_id: string;
      target_type: string;
      target_id: string;
      date_id: string | null;
    }[];
    const datesById = this.dates.getMany(rows.map((row) => row.date_id).filter((id): id is string => id !== null));
    return rows.map((row) => ({
      tagId: row.tag_id,
      link: {
        id: row.id,
        tagId: row.tag_id,
        targetType: row.target_type,
        targetId: row.target_id,
        date: row.date_id !== null ? datesById.get(row.date_id) : undefined,
      },
    }));
  }

  // bulk cascade -------------------------------------------------------------

  /** Deletes every attachment row of the target (except notes/citations/media, which own their links). */
  deleteAllFor(targetType: string, targetId: string): void {
    const changeDates = this.db
      .prepare('SELECT date_id FROM change WHERE target_type = ? AND target_id = ? AND date_id IS NOT NULL')
      .all(targetType, targetId) as unknown as { date_id: string }[];
    for (const table of ['identifier', 'contact', 'restriction', 'tag_link', 'change'] as const) {
      this.db.prepare(`DELETE FROM ${table} WHERE target_type = ? AND target_id = ?`).run(targetType, targetId);
    }
    for (const entry of changeDates) {
      this.dates.delete(entry.date_id);
    }
  }
}
