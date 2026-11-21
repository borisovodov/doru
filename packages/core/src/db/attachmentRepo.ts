import type { DatabaseSync } from 'node:sqlite';
import type { ContactRecord, IdentifierRecord, RestrictionRecord, TagLinkRecord, TagRecord } from '../model/types';
import type { DateRepo } from './dateRepo';

/**
 * The universal attachment tables: identifiers, contacts, restrictions,
 * tags and tag links — all sharing the polymorphic `(target_type, target_id)`
 * shape.
 */
export class AttachmentRepo {
  constructor(
    private readonly db: DatabaseSync,
    private readonly dates: DateRepo,
  ) {}

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

  // restrictions ------------------------------------------------------------

  insertRestriction(restriction: RestrictionRecord): void {
    this.db
      .prepare('INSERT INTO restriction (id, target_type, target_id, level) VALUES (?, ?, ?, ?)')
      .run(restriction.id, restriction.targetType, restriction.targetId, restriction.level);
  }

  deleteRestriction(id: string): boolean {
    return this.db.prepare('DELETE FROM restriction WHERE id = ?').run(id).changes > 0;
  }

  updateRestriction(restriction: RestrictionRecord): void {
    this.db
      .prepare('UPDATE restriction SET target_type = ?, target_id = ?, level = ? WHERE id = ?')
      .run(restriction.targetType, restriction.targetId, restriction.level, restriction.id);
  }

  listRestrictionsFor(targetType: string, targetId: string): RestrictionRecord[] {
    const rows = this.db
      .prepare(
        'SELECT id, target_type, target_id, level FROM restriction WHERE target_type = ? AND target_id = ? ORDER BY id',
      )
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

  // tags ---------------------------------------------------------------------

  insertTag(tag: TagRecord): void {
    this.db.prepare('INSERT INTO tag (id, name) VALUES (?, ?)').run(tag.id, tag.name);
  }

  deleteTag(id: string): boolean {
    return this.db.prepare('DELETE FROM tag WHERE id = ?').run(id).changes > 0;
  }

  updateTag(tag: TagRecord): void {
    this.db.prepare('UPDATE tag SET name = ? WHERE id = ?').run(tag.name, tag.id);
  }

  listTags(): TagRecord[] {
    const rows = this.db.prepare('SELECT id, name FROM tag ORDER BY name').all() as unknown as {
      id: string;
      name: string;
    }[];
    return rows.map((row) => ({ id: row.id, name: row.name }));
  }

  insertTagLink(link: TagLinkRecord): void {
    this.db
      .prepare('INSERT INTO tag_link (id, tag_id, target_type, target_id) VALUES (?, ?, ?, ?)')
      .run(link.id, link.tagId, link.targetType, link.targetId);
    this.dates.upsertForOwner('tag_link', link.id, 'date', link.date);
  }

  deleteTagLink(id: string): boolean {
    return this.db.prepare('DELETE FROM tag_link WHERE id = ?').run(id).changes > 0;
  }

  updateTagLink(link: TagLinkRecord): void {
    if (this.db.prepare('SELECT 1 FROM tag_link WHERE id = ?').get(link.id) === undefined) {
      throw new Error(`tag_link ${link.id} no longer exists`);
    }
    this.db
      .prepare('UPDATE tag_link SET tag_id = ?, target_type = ?, target_id = ? WHERE id = ?')
      .run(link.tagId, link.targetType, link.targetId, link.id);
    this.dates.upsertForOwner('tag_link', link.id, 'date', link.date);
  }

  listTagLinksFor(targetType: string, targetId: string): Array<{ tagId: string; link: TagLinkRecord }> {
    const rows = this.db
      .prepare(
        'SELECT id, tag_id, target_type, target_id FROM tag_link WHERE target_type = ? AND target_id = ? ORDER BY id',
      )
      .all(targetType, targetId) as unknown as {
      id: string;
      tag_id: string;
      target_type: string;
      target_id: string;
    }[];
    const datesByOwner = this.dates.getManyForOwners(
      'tag_link',
      rows.map((row) => row.id),
    );
    return rows.map((row) => ({
      tagId: row.tag_id,
      link: {
        id: row.id,
        tagId: row.tag_id,
        targetType: row.target_type,
        targetId: row.target_id,
        date: datesByOwner.get(row.id)?.get('date'),
      },
    }));
  }

  getTagLink(id: string): TagLinkRecord | undefined {
    const row = this.db.prepare('SELECT id, tag_id, target_type, target_id FROM tag_link WHERE id = ?').get(id) as
      | { id: string; tag_id: string; target_type: string; target_id: string }
      | undefined;
    if (row === undefined) {
      return undefined;
    }
    return {
      id: row.id,
      tagId: row.tag_id,
      targetType: row.target_type,
      targetId: row.target_id,
      date: this.dates.getForOwner('tag_link', row.id, 'date'),
    };
  }

  listTagLinksByTag(tagId: string): TagLinkRecord[] {
    const rows = this.db
      .prepare('SELECT id, tag_id, target_type, target_id FROM tag_link WHERE tag_id = ? ORDER BY id')
      .all(tagId) as unknown as {
      id: string;
      tag_id: string;
      target_type: string;
      target_id: string;
    }[];
    const datesByOwner = this.dates.getManyForOwners(
      'tag_link',
      rows.map((row) => row.id),
    );
    return rows.map((row) => ({
      id: row.id,
      tagId: row.tag_id,
      targetType: row.target_type,
      targetId: row.target_id,
      date: datesByOwner.get(row.id)?.get('date'),
    }));
  }

  /** Every tag link in the tree, for the global tag registry. */
  listAllTagLinks(): TagLinkRecord[] {
    const rows = this.db
      .prepare('SELECT id, tag_id, target_type, target_id FROM tag_link ORDER BY id')
      .all() as unknown as {
      id: string;
      tag_id: string;
      target_type: string;
      target_id: string;
    }[];
    const datesByOwner = this.dates.getManyForOwners(
      'tag_link',
      rows.map((row) => row.id),
    );
    return rows.map((row) => ({
      id: row.id,
      tagId: row.tag_id,
      targetType: row.target_type,
      targetId: row.target_id,
      date: datesByOwner.get(row.id)?.get('date'),
    }));
  }

  // bulk cascade -------------------------------------------------------------

  /** Deletes every attachment row of the target (except notes/citations/media, which own their links). */
  deleteAllFor(targetType: string, targetId: string): void {
    for (const table of ['identifier', 'contact', 'restriction', 'tag_link'] as const) {
      this.db.prepare(`DELETE FROM ${table} WHERE target_type = ? AND target_id = ?`).run(targetType, targetId);
    }
  }
}
