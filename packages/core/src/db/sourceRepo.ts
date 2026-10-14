import type { DatabaseSync } from 'node:sqlite';
import type { SourceRecord } from '../model/types';

export class SourceRepo {
  constructor(private readonly db: DatabaseSync) {}

  insertSource(source: SourceRecord): void {
    this.db
      .prepare('INSERT INTO source (id, title, author, publication) VALUES (?, ?, ?, ?)')
      .run(source.id, source.title, source.author ?? null, source.publication ?? null);
  }

  deleteSource(id: string): boolean {
    const result = this.db.prepare('DELETE FROM source WHERE id = ?').run(id);
    return result.changes > 0;
  }

  listSources(): SourceRecord[] {
    const rows = this.db.prepare('SELECT id, title, author, publication FROM source ORDER BY id').all() as unknown as {
      id: string;
      title: string;
      author: string | null;
      publication: string | null;
    }[];
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      author: row.author ?? undefined,
      publication: row.publication ?? undefined,
    }));
  }

  addSourceCitation(sourceId: string, targetType: string, targetId: string): void {
    this.insertCitation({ id: crypto.randomUUID(), sourceId, targetType, targetId });
  }

  insertCitation(citation: { id: string; sourceId: string; targetType: string; targetId: string }): void {
    this.db
      .prepare('INSERT INTO citation (id, source_id, target_type, target_id) VALUES (?, ?, ?, ?)')
      .run(citation.id, citation.sourceId, citation.targetType, citation.targetId);
  }

  deleteCitation(id: string): boolean {
    const result = this.db.prepare('DELETE FROM citation WHERE id = ?').run(id);
    return result.changes > 0;
  }

  getCitation(id: string): { id: string; sourceId: string; targetType: string; targetId: string } | undefined {
    const row = this.db
      .prepare('SELECT id, source_id, target_type, target_id FROM citation WHERE id = ?')
      .get(id) as { id: string; source_id: string; target_type: string; target_id: string } | undefined;
    if (!row) {
      return undefined;
    }
    return { id: row.id, sourceId: row.source_id, targetType: row.target_type, targetId: row.target_id };
  }

  listCitationsFor(targetType: string, targetId: string): Array<{ id: string; source: SourceRecord }> {
    const rows = this.db
      .prepare('SELECT c.id, s.id AS source_id, s.title, s.author, s.publication FROM citation c JOIN source s ON s.id = c.source_id WHERE c.target_type = ? AND c.target_id = ? ORDER BY c.id')
      .all(targetType, targetId) as unknown as Array<{
      id: string;
      source_id: string;
      title: string;
      author: string | null;
      publication: string | null;
    }>;
    return rows.map((row) => ({
      id: row.id,
      source: {
        id: row.source_id,
        title: row.title,
        author: row.author ?? undefined,
        publication: row.publication ?? undefined,
      },
    }));
  }
}
