import type { DatabaseSync } from 'node:sqlite';
import type { SubmitterRecord } from '../model/types';

/** Submitters (GEDCOM SUBM) and their record links (SUBM on records). */
export class SubmitterRepo {
  constructor(private readonly db: DatabaseSync) {}

  insertSubmitter(submitter: SubmitterRecord): void {
    this.db
      .prepare('INSERT INTO submitter (id, xref, name, address_id) VALUES (?, ?, ?, ?)')
      .run(submitter.id, submitter.xref ?? null, submitter.name, submitter.addressId ?? null);
    for (const language of submitter.languages ?? []) {
      this.db.prepare('INSERT INTO submitter_language (submitter_id, language) VALUES (?, ?)').run(submitter.id, language);
    }
  }

  updateSubmitter(submitter: SubmitterRecord): void {
    this.db
      .prepare('UPDATE submitter SET xref = ?, name = ?, address_id = ? WHERE id = ?')
      .run(submitter.xref ?? null, submitter.name, submitter.addressId ?? null, submitter.id);
    this.db.prepare('DELETE FROM submitter_language WHERE submitter_id = ?').run(submitter.id);
    for (const language of submitter.languages ?? []) {
      this.db.prepare('INSERT INTO submitter_language (submitter_id, language) VALUES (?, ?)').run(submitter.id, language);
    }
  }

  getSubmitter(id: string): SubmitterRecord | undefined {
    const row = this.db
      .prepare('SELECT id, xref, name, address_id FROM submitter WHERE id = ?')
      .get(id) as { id: string; xref: string | null; name: string; address_id: string | null } | undefined;
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
    };
    if (languages.length > 0) {
      submitter.languages = languages.map((entry) => entry.language);
    }
    return submitter;
  }

  listSubmitters(): SubmitterRecord[] {
    const rows = this.db
      .prepare('SELECT id, xref, name, address_id FROM submitter ORDER BY id')
      .all() as unknown as { id: string; xref: string | null; name: string; address_id: string | null }[];
    return rows
      .map((row) => this.getSubmitter(row.id))
      .filter((submitter): submitter is SubmitterRecord => submitter !== undefined);
  }

  deleteSubmitter(id: string): boolean {
    return this.db.prepare('DELETE FROM submitter WHERE id = ?').run(id).changes > 0;
  }

  insertRecordSubmitter(id: string, submitterId: string, targetType: string, targetId: string): void {
    this.db
      .prepare('INSERT INTO record_submitter (id, submitter_id, target_type, target_id) VALUES (?, ?, ?, ?)')
      .run(id, submitterId, targetType, targetId);
  }

  listSubmittersFor(targetType: string, targetId: string): string[] {
    const rows = this.db
      .prepare('SELECT submitter_id FROM record_submitter WHERE target_type = ? AND target_id = ? ORDER BY id')
      .all(targetType, targetId) as unknown as { submitter_id: string }[];
    return rows.map((row) => row.submitter_id);
  }

  /** The full record_submitter rows of a target, for op snapshots. */
  listRecordSubmittersFor(
    targetType: string,
    targetId: string,
  ): Array<{ id: string; submitterId: string; targetType: string; targetId: string }> {
    const rows = this.db
      .prepare('SELECT id, submitter_id, target_type, target_id FROM record_submitter WHERE target_type = ? AND target_id = ? ORDER BY id')
      .all(targetType, targetId) as unknown as { id: string; submitter_id: string; target_type: string; target_id: string }[];
    return rows.map((row) => ({
      id: row.id,
      submitterId: row.submitter_id,
      targetType: row.target_type,
      targetId: row.target_id,
    }));
  }

  deleteRecordSubmittersFor(targetType: string, targetId: string): void {
    this.db.prepare('DELETE FROM record_submitter WHERE target_type = ? AND target_id = ?').run(targetType, targetId);
  }
}
