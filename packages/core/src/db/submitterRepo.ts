import type { DatabaseSync } from 'node:sqlite';
import type { RecordSubmitterLink, SubmitterRecord } from '../model/types';

interface RecordSubmitterRow {
  id: string;
  submitter_id: string;
  target_type: string;
  target_id: string;
  kind: string;
}

const RECORD_SUBMITTER_COLUMNS = 'id, submitter_id, target_type, target_id, kind';

function decodeRecordSubmitter(row: RecordSubmitterRow): RecordSubmitterLink {
  return {
    id: row.id,
    submitterId: row.submitter_id,
    targetType: row.target_type,
    targetId: row.target_id,
    kind: row.kind as RecordSubmitterLink['kind'],
  };
}

/** Submitters (GEDCOM SUBM) and their record links (SUBM on records). */
export class SubmitterRepo {
  constructor(private readonly db: DatabaseSync) {}

  insertSubmitter(submitter: SubmitterRecord): void {
    this.db
      .prepare('INSERT INTO submitter (id, xref, name, address_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(
        submitter.id,
        submitter.xref ?? null,
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
      .prepare('UPDATE submitter SET xref = ?, name = ?, address_id = ?, created_at = ?, updated_at = ? WHERE id = ?')
      .run(
        submitter.xref ?? null,
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
      .prepare('SELECT id, xref, name, address_id, created_at, updated_at FROM submitter WHERE id = ?')
      .get(id) as
      | {
          id: string;
          xref: string | null;
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
      xref: row.xref ?? undefined,
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
    const rows = this.db.prepare('SELECT id, xref, name, address_id FROM submitter ORDER BY id').all() as unknown as {
      id: string;
      xref: string | null;
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

  insertRecordSubmitter(
    id: string,
    submitterId: string,
    targetType: string,
    targetId: string,
    kind: RecordSubmitterLink['kind'] = 'contributor',
  ): void {
    this.db
      .prepare('INSERT INTO record_submitter (id, submitter_id, target_type, target_id, kind) VALUES (?, ?, ?, ?, ?)')
      .run(id, submitterId, targetType, targetId, kind);
  }

  getRecordSubmitter(id: string): RecordSubmitterLink | undefined {
    const row = this.db.prepare(`SELECT ${RECORD_SUBMITTER_COLUMNS} FROM record_submitter WHERE id = ?`).get(id) as
      | RecordSubmitterRow
      | undefined;
    return row === undefined ? undefined : decodeRecordSubmitter(row);
  }

  /** Only ordinary SUBM contributions; ANCI/DESI interests are separate. */
  listSubmittersFor(targetType: string, targetId: string): string[] {
    const rows = this.db
      .prepare(
        `SELECT submitter_id FROM record_submitter
         WHERE target_type = ? AND target_id = ? AND kind = 'contributor' ORDER BY id`,
      )
      .all(targetType, targetId) as unknown as { submitter_id: string }[];
    return rows.map((row) => row.submitter_id);
  }

  /** The full record_submitter rows of a target, for op snapshots. */
  listRecordSubmittersFor(targetType: string, targetId: string): RecordSubmitterLink[] {
    const rows = this.db
      .prepare(
        `SELECT ${RECORD_SUBMITTER_COLUMNS} FROM record_submitter
         WHERE target_type = ? AND target_id = ? ORDER BY id`,
      )
      .all(targetType, targetId) as unknown as RecordSubmitterRow[];
    return rows.map(decodeRecordSubmitter);
  }

  /** Every record this submitter contributes to, for the delete/undo snapshot. */
  listRecordSubmittersForSubmitter(submitterId: string): RecordSubmitterLink[] {
    const rows = this.db
      .prepare(
        `SELECT ${RECORD_SUBMITTER_COLUMNS} FROM record_submitter
         WHERE submitter_id = ? ORDER BY id`,
      )
      .all(submitterId) as unknown as RecordSubmitterRow[];
    return rows.map(decodeRecordSubmitter);
  }

  /** Every submitter link in the tree, for the global registries. */
  listAllRecordSubmitters(): RecordSubmitterLink[] {
    const rows = this.db
      .prepare(`SELECT ${RECORD_SUBMITTER_COLUMNS} FROM record_submitter ORDER BY id`)
      .all() as unknown as RecordSubmitterRow[];
    return rows.map(decodeRecordSubmitter);
  }

  deleteRecordSubmittersFor(targetType: string, targetId: string): void {
    this.db.prepare('DELETE FROM record_submitter WHERE target_type = ? AND target_id = ?').run(targetType, targetId);
  }

  deleteRecordSubmitter(id: string): boolean {
    return this.db.prepare('DELETE FROM record_submitter WHERE id = ?').run(id).changes > 0;
  }
}
