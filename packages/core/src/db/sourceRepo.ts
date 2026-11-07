import type { DatabaseSync } from 'node:sqlite';
import type { CitationRecord, SourceRecord } from '../model/types';

interface SourceRow {
  id: string;
  xref: string | null;
  title: string;
  abbreviation: string | null;
  author: string | null;
  publication: string | null;
}

interface CitationRow {
  id: string;
  source_id: string;
  target_type: string;
  target_id: string;
  page: string | null;
  quality: string | null;
}

export class SourceRepo {
  constructor(private readonly db: DatabaseSync) {}

  insertSource(source: SourceRecord): void {
    this.db
      .prepare('INSERT INTO source (id, xref, title, abbreviation, author, publication) VALUES (?, ?, ?, ?, ?, ?)')
      .run(
        source.id,
        source.xref ?? null,
        source.title,
        source.abbreviation ?? null,
        source.author ?? null,
        source.publication ?? null,
      );
  }

  deleteSource(id: string): boolean {
    const result = this.db.prepare('DELETE FROM source WHERE id = ?').run(id);
    return result.changes > 0;
  }

  listSources(): SourceRecord[] {
    const rows = this.db
      .prepare('SELECT id, xref, title, abbreviation, author, publication FROM source ORDER BY id')
      .all() as unknown as SourceRow[];
    return rows.map(rowToSource);
  }

  addSourceCitation(sourceId: string, targetType: string, targetId: string): void {
    this.insertCitation({ id: crypto.randomUUID(), sourceId, targetType, targetId });
  }

  insertCitation(citation: CitationRecord): void {
    this.db
      .prepare('INSERT INTO citation (id, source_id, target_type, target_id, page, quality) VALUES (?, ?, ?, ?, ?, ?)')
      .run(citation.id, citation.sourceId, citation.targetType, citation.targetId, citation.page ?? null, citation.quality ?? null);
  }

  deleteCitation(id: string): boolean {
    const result = this.db.prepare('DELETE FROM citation WHERE id = ?').run(id);
    return result.changes > 0;
  }

  getCitation(id: string): CitationRecord | undefined {
    const row = this.db
      .prepare('SELECT id, source_id, target_type, target_id, page, quality FROM citation WHERE id = ?')
      .get(id) as CitationRow | undefined;
    return row ? rowToCitation(row) : undefined;
  }

  listCitationsFor(targetType: string, targetId: string): Array<{ id: string; source: SourceRecord }> {
    const rows = this.db
      .prepare(
        `SELECT c.id, s.id AS source_id, s.xref, s.title, s.abbreviation, s.author, s.publication
         FROM citation c JOIN source s ON s.id = c.source_id
         WHERE c.target_type = ? AND c.target_id = ? ORDER BY c.id`,
      )
      .all(targetType, targetId) as unknown as Array<{
      id: string;
      source_id: string;
      xref: string | null;
      title: string;
      abbreviation: string | null;
      author: string | null;
      publication: string | null;
    }>;
    return rows.map((row) => ({
      id: row.id,
      source: rowToSource({
        id: row.source_id,
        xref: row.xref,
        title: row.title,
        abbreviation: row.abbreviation,
        author: row.author,
        publication: row.publication,
      }),
    }));
  }

  /** The full citation rows for a target, including page and quality. */
  listCitations(targetType: string, targetId: string): CitationRecord[] {
    const rows = this.db
      .prepare('SELECT id, source_id, target_type, target_id, page, quality FROM citation WHERE target_type = ? AND target_id = ? ORDER BY id')
      .all(targetType, targetId) as unknown as CitationRow[];
    return rows.map(rowToCitation);
  }

  /** Every citation in the tree. */
  listAllCitations(): CitationRecord[] {
    const rows = this.db
      .prepare('SELECT id, source_id, target_type, target_id, page, quality FROM citation ORDER BY id')
      .all() as unknown as CitationRow[];
    return rows.map(rowToCitation);
  }
}

function rowToSource(row: SourceRow): SourceRecord {
  return {
    id: row.id,
    xref: row.xref ?? undefined,
    title: row.title,
    abbreviation: row.abbreviation ?? undefined,
    author: row.author ?? undefined,
    publication: row.publication ?? undefined,
  };
}

function rowToCitation(row: CitationRow): CitationRecord {
  return {
    id: row.id,
    sourceId: row.source_id,
    targetType: row.target_type,
    targetId: row.target_id,
    page: row.page ?? undefined,
    quality: row.quality ?? undefined,
  };
}
