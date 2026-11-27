import type { DatabaseSync } from 'node:sqlite';
import type { SubmitterLink, SubmitterRecord } from '../model/types';

interface SubmitterLinkRow {
  id: string;
  submitter_id: string;
  target_type: string;
  target_id: string;
  kind: string;
}

const SUBMITTER_LINK_COLUMNS = 'id, submitter_id, target_type, target_id, kind';

function decodeSubmitterLink(row: SubmitterLinkRow): SubmitterLink {
  return {
    id: row.id,
    submitterId: row.submitter_id,
    targetType: row.target_type,
    targetId: row.target_id,
    kind: row.kind as SubmitterLink['kind'],
  };
}

/** Submitters (GEDCOM SUBM) and their record links (SUBM on records). */
export class SubmitterRepo {
  constructor(private readonly db: DatabaseSync) {}

  insertSubmitter(submitter: SubmitterRecord): void {
    this.db
      .prepare('INSERT INTO submitter (id, name, address_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run(
        submitter.id,
        submitter.name,
        submitter.addressId ?? null,
        submitter.createdAt ?? null,
        submitter.updatedAt ?? null,
      );
    for (const language of submitter.languages ?? []) {
      this.db
        .prepare('INSERT INTO submitter_language (submitter_id, language) VALUES (?, ?)')
        .run(submitter.id, language);
    }
  }

  updateSubmitter(submitter: SubmitterRecord): void {
    this.db
      .prepare('UPDATE submitter SET name = ?, address_id = ?, created_at = ?, updated_at = ? WHERE id = ?')
      .run(
        submitter.name,
        submitter.addressId ?? null,
        submitter.createdAt ?? null,
        submitter.updatedAt ?? null,
        submitter.id,
      );
    this.db.prepare('DELETE FROM submitter_language WHERE submitter_id = ?').run(submitter.id);
    for (const language of submitter.languages ?? []) {
      this.db
        .prepare('INSERT INTO submitter_language (submitter_id, language) VALUES (?, ?)')
        .run(submitter.id, language);
    }
  }

  setAddressId(id: string, addressId: string | undefined): void {
    this.db
      .prepare('UPDATE submitter SET address_id = ? WHERE id = ? AND address_id IS NULL')
      .run(addressId ?? null, id);
  }

  getSubmitter(id: string): SubmitterRecord | undefined {
    const row = this.db
      .prepare('SELECT id, name, address_id, created_at, updated_at FROM submitter WHERE id = ?')
      .get(id) as
      | {
          id: string;
          name: string;
          address_id: string | null;
          created_at: number | null;
          updated_at: number | null;
        }
      | undefined;
    if (!row) {
      return undefined;
    }
    const languages = this.db
      .prepare('SELECT language FROM submitter_language WHERE submitter_id = ? ORDER BY language')
      .all(id) as unknown as { language: string }[];
    const submitter: SubmitterRecord = {
      id: row.id,
      name: row.name,
      addressId: row.address_id ?? undefined,
      createdAt: row.created_at ?? undefined,
      updatedAt: row.updated_at ?? undefined,
    };
    if (languages.length > 0) {
      submitter.languages = languages.map((entry) => entry.language);
    }
    return submitter;
  }

  listSubmitters(): SubmitterRecord[] {
    const rows = this.db.prepare('SELECT id, name, address_id FROM submitter ORDER BY id').all() as unknown as {
      id: string;
      name: string;
      address_id: string | null;
    }[];
    return rows
      .map((row) => this.getSubmitter(row.id))
      .filter((submitter): submitter is SubmitterRecord => submitter !== undefined);
  }

  deleteSubmitter(id: string): boolean {
    return this.db.prepare('DELETE FROM submitter WHERE id = ?').run(id).changes > 0;
  }

  insertSubmitterLink(
    id: string,
    submitterId: string,
    targetType: string,
    targetId: string,
    kind: SubmitterLink['kind'] = 'contributor',
  ): void {
    this.db
      .prepare('INSERT INTO submitter_link (id, submitter_id, target_type, target_id, kind) VALUES (?, ?, ?, ?, ?)')
      .run(id, submitterId, targetType, targetId, kind);
  }

  getSubmitterLink(id: string): SubmitterLink | undefined {
    const row = this.db.prepare(`SELECT ${SUBMITTER_LINK_COLUMNS} FROM submitter_link WHERE id = ?`).get(id) as
      | SubmitterLinkRow
      | undefined;
    return row === undefined ? undefined : decodeSubmitterLink(row);
  }

  /** Only ordinary SUBM contributions; ANCI/DESI interests are separate. */
  listSubmittersFor(targetType: string, targetId: string): string[] {
    const rows = this.db
      .prepare(
        `SELECT submitter_id FROM submitter_link
         WHERE target_type = ? AND target_id = ? AND kind = 'contributor' ORDER BY id`,
      )
      .all(targetType, targetId) as unknown as { submitter_id: string }[];
    return rows.map((row) => row.submitter_id);
  }

  /** The full submitter_link rows of a target, for op snapshots. */
  listSubmitterLinksFor(targetType: string, targetId: string): SubmitterLink[] {
    const rows = this.db
      .prepare(
        `SELECT ${SUBMITTER_LINK_COLUMNS} FROM submitter_link
         WHERE target_type = ? AND target_id = ? ORDER BY id`,
      )
      .all(targetType, targetId) as unknown as SubmitterLinkRow[];
    return rows.map(decodeSubmitterLink);
  }

  /** Every record this submitter contributes to, for the delete/undo snapshot. */
  listSubmitterLinksForSubmitter(submitterId: string): SubmitterLink[] {
    const rows = this.db
      .prepare(
        `SELECT ${SUBMITTER_LINK_COLUMNS} FROM submitter_link
         WHERE submitter_id = ? ORDER BY id`,
      )
      .all(submitterId) as unknown as SubmitterLinkRow[];
    return rows.map(decodeSubmitterLink);
  }

  /** Every submitter link in the tree, for the global registries. */
  listAllSubmitterLinks(): SubmitterLink[] {
    const rows = this.db
      .prepare(`SELECT ${SUBMITTER_LINK_COLUMNS} FROM submitter_link ORDER BY id`)
      .all() as unknown as SubmitterLinkRow[];
    return rows.map(decodeSubmitterLink);
  }

  deleteSubmitterLinksFor(targetType: string, targetId: string): void {
    this.db.prepare('DELETE FROM submitter_link WHERE target_type = ? AND target_id = ?').run(targetType, targetId);
  }

  deleteSubmitterLink(id: string): boolean {
    return this.db.prepare('DELETE FROM submitter_link WHERE id = ?').run(id).changes > 0;
  }
}
