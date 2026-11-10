import type { DatabaseSync } from 'node:sqlite';
import type { CitationRecord, SourceRecord } from '../model/types';
import type { DateRepo } from './dateRepo';

interface SourceRow {
  id: string;
  xref: string | null;
  title: string | null;
  abbreviation: string | null;
  author: string | null;
  publication: string | null;
  medium: string | null;
  url: string | null;
  access_date: string | null;
  confidence: string | null;
  pub_date_id: string | null;
  pub_place_text: string | null;
  agency: string | null;
  title_id: string | null;
}

interface CitationRow {
  id: string;
  source_id: string;
  target_type: string;
  target_id: string;
  description: string | null;
  page: string | null;
  quality: string | null;
  confidence: string | null;
  event: string | null;
  role: string | null;
  phrase: string | null;
  date_id: string | null;
  www: string | null;
}

/**
 * Sources (with their texts, data events, repository links, call numbers and
 * template fields) and citations (with their texts and template fields).
 */
export class SourceRepo {
  constructor(
    private readonly db: DatabaseSync,
    private readonly dates: DateRepo,
  ) {}

  insertSource(source: SourceRecord): void {
    this.db
      .prepare(
        `INSERT INTO source (id, xref, title, abbreviation, author, publication,
           medium, url, access_date, confidence, pub_date_id, pub_place_text, agency, title_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(...sourceParams(source, this.dates));
    this.replaceSourceDetails(source);
  }

  updateSource(source: SourceRecord): void {
    this.db
      .prepare(
        `UPDATE source SET xref = ?, title = ?, abbreviation = ?, author = ?, publication = ?,
           medium = ?, url = ?, access_date = ?, confidence = ?, pub_date_id = ?, pub_place_text = ?, agency = ?, title_id = ?
         WHERE id = ?`,
      )
      .run(...sourceParams(source, this.dates).slice(1), source.id);
    this.replaceSourceDetails(source);
  }

  deleteSource(id: string): boolean {
    const row = this.db.prepare('SELECT pub_date_id FROM source WHERE id = ?').get(id) as
      | { pub_date_id: string | null }
      | undefined;
    // Citation rows cascade with the source; their date rows must go too.
    const citationDateIds = this.db
      .prepare('SELECT date_id FROM citation WHERE source_id = ? AND date_id IS NOT NULL')
      .all(id) as unknown as { date_id: string }[];
    const result = this.db.prepare('DELETE FROM source WHERE id = ?').run(id);
    for (const dateId of citationDateIds.map((entry) => entry.date_id)) {
      this.dates.delete(dateId);
    }
    if (row?.pub_date_id !== null && row?.pub_date_id !== undefined) {
      this.dates.delete(row.pub_date_id);
    }
    return result.changes > 0;
  }

  getSource(id: string): SourceRecord | undefined {
    const row = this.db.prepare(`${sourceSelect} WHERE id = ?`).get(id) as SourceRow | undefined;
    return row ? this.hydrate(row) : undefined;
  }

  listSources(): SourceRecord[] {
    const rows = this.db.prepare(`${sourceSelect} ORDER BY id`).all() as unknown as SourceRow[];
    return rows.map((row) => this.hydrate(row));
  }

  addSourceCitation(sourceId: string, targetType: string, targetId: string): void {
    this.insertCitation({ id: crypto.randomUUID(), sourceId, targetType, targetId });
  }

  insertCitation(citation: CitationRecord): void {
    this.db
      .prepare(
        `INSERT INTO citation (id, source_id, target_type, target_id, description, page, quality,
           confidence, event, role, phrase, date_id, www)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(...citationParams(citation, this.dates));
    this.replaceCitationDetails(citation);
  }

  updateCitation(citation: CitationRecord): void {
    this.db
      .prepare(
        `UPDATE citation SET source_id = ?, target_type = ?, target_id = ?, description = ?, page = ?,
           quality = ?, confidence = ?, event = ?, role = ?, phrase = ?, date_id = ?, www = ?
         WHERE id = ?`,
      )
      .run(...citationParams(citation, this.dates).slice(1), citation.id);
    this.replaceCitationDetails(citation);
  }

  deleteCitation(id: string): boolean {
    const row = this.db.prepare('SELECT date_id FROM citation WHERE id = ?').get(id) as
      | { date_id: string | null }
      | undefined;
    const result = this.db.prepare('DELETE FROM citation WHERE id = ?').run(id);
    if (row?.date_id !== null && row?.date_id !== undefined) {
      this.dates.delete(row.date_id);
    }
    return result.changes > 0;
  }

  getCitation(id: string): CitationRecord | undefined {
    const row = this.db.prepare(`${citationSelect} WHERE id = ?`).get(id) as CitationRow | undefined;
    return row ? this.hydrateCitation(row) : undefined;
  }

  listCitationsFor(targetType: string, targetId: string): Array<{ id: string; source: SourceRecord }> {
    const rows = this.db
      .prepare(
        `SELECT c.id, s.id AS source_id
         FROM citation c JOIN source s ON s.id = c.source_id
         WHERE c.target_type = ? AND c.target_id = ? ORDER BY c.id`,
      )
      .all(targetType, targetId) as unknown as { id: string; source_id: string }[];
    return rows.map((row) => ({ id: row.id, source: this.getSource(row.source_id)! }));
  }

  /** The full citation rows for a target, including page and quality. */
  listCitations(targetType: string, targetId: string): CitationRecord[] {
    const rows = this.db
      .prepare(`${citationSelect} WHERE target_type = ? AND target_id = ? ORDER BY id`)
      .all(targetType, targetId) as unknown as CitationRow[];
    return rows.map((row) => this.hydrateCitation(row));
  }

  /** Every citation in the tree. */
  listAllCitations(): CitationRecord[] {
    const rows = this.db.prepare(`${citationSelect} ORDER BY id`).all() as unknown as CitationRow[];
    return rows.map((row) => this.hydrateCitation(row));
  }

  /** Deletes every citation of the target together with their date rows (cascade part). */
  deleteCitationsFor(targetType: string, targetId: string): void {
    const rows = this.db
      .prepare('SELECT id, date_id FROM citation WHERE target_type = ? AND target_id = ?')
      .all(targetType, targetId) as unknown as { id: string; date_id: string | null }[];
    this.db.prepare('DELETE FROM citation WHERE target_type = ? AND target_id = ?').run(targetType, targetId);
    for (const row of rows) {
      if (row.date_id !== null) {
        this.dates.delete(row.date_id);
      }
    }
  }

  private replaceSourceDetails(source: SourceRecord): void {
    this.db.prepare('DELETE FROM source_text WHERE source_id = ?').run(source.id);
    this.db.prepare('DELETE FROM source_data_event WHERE source_id = ?').run(source.id);
    this.db.prepare('DELETE FROM source_repository WHERE source_id = ?').run(source.id);
    this.db.prepare('DELETE FROM source_template_field WHERE source_id = ?').run(source.id);

    const insertText = this.db.prepare(
      'INSERT INTO source_text (id, source_id, text, mime, language) VALUES (?, ?, ?, ?, ?)',
    );
    for (const text of source.texts ?? []) {
      insertText.run(text.id, source.id, text.text, text.mime ?? null, text.language ?? null);
    }
    const insertEvent = this.db.prepare(
      'INSERT INTO source_data_event (id, source_id, tag, value, date_id, place_id) VALUES (?, ?, ?, ?, ?, ?)',
    );
    for (const event of source.dataEvents ?? []) {
      insertEvent.run(
        event.id,
        source.id,
        event.tag,
        event.value ?? null,
        event.date ? this.dates.upsert(event.date) : null,
        event.placeId ?? null,
      );
    }
    const insertRepository = this.db.prepare(
      'INSERT INTO source_repository (id, source_id, repository_id) VALUES (?, ?, ?)',
    );
    const insertCallNumber = this.db.prepare(
      'INSERT INTO call_number (id, source_repository_id, value, medium) VALUES (?, ?, ?, ?)',
    );
    for (const repository of source.repositories ?? []) {
      insertRepository.run(repository.id, source.id, repository.repositoryId);
      for (const callNumber of repository.callNumbers ?? []) {
        insertCallNumber.run(callNumber.id, repository.id, callNumber.value, callNumber.medium ?? null);
      }
    }
    const insertField = this.db.prepare(
      'INSERT INTO source_template_field (id, source_id, name, value, position) VALUES (?, ?, ?, ?, ?)',
    );
    (source.templateFields ?? []).forEach((field, position) => {
      insertField.run(field.id, source.id, field.name, field.value ?? null, position);
    });
  }

  private replaceCitationDetails(citation: CitationRecord): void {
    this.db.prepare('DELETE FROM citation_text WHERE citation_id = ?').run(citation.id);
    this.db.prepare('DELETE FROM citation_template_field WHERE citation_id = ?').run(citation.id);
    const insertText = this.db.prepare(
      'INSERT INTO citation_text (id, citation_id, text, mime, language) VALUES (?, ?, ?, ?, ?)',
    );
    for (const text of citation.texts ?? []) {
      insertText.run(text.id, citation.id, text.text, text.mime ?? null, text.language ?? null);
    }
    const insertField = this.db.prepare(
      'INSERT INTO citation_template_field (id, citation_id, name, value, position) VALUES (?, ?, ?, ?, ?)',
    );
    (citation.templateFields ?? []).forEach((field, position) => {
      insertField.run(field.id, citation.id, field.name, field.value ?? null, position);
    });
  }

  private hydrate(row: SourceRow): SourceRecord {
    const datesById = this.dates.getMany(
      [row.pub_date_id, ...(this.listSourceEventDateIds(row.id) ?? [])].filter((id): id is string => id !== null),
    );
    const texts = this.db
      .prepare('SELECT id, text, mime, language FROM source_text WHERE source_id = ? ORDER BY id')
      .all(row.id) as unknown as { id: string; text: string; mime: string | null; language: string | null }[];
    const events = this.db
      .prepare('SELECT id, tag, value, date_id, place_id FROM source_data_event WHERE source_id = ? ORDER BY id')
      .all(row.id) as unknown as { id: string; tag: string; value: string | null; date_id: string | null; place_id: string | null }[];
    const repositories = this.db
      .prepare('SELECT id, repository_id FROM source_repository WHERE source_id = ? ORDER BY id')
      .all(row.id) as unknown as { id: string; repository_id: string }[];
    const fields = this.db
      .prepare('SELECT id, name, value FROM source_template_field WHERE source_id = ? ORDER BY position')
      .all(row.id) as unknown as { id: string; name: string; value: string | null }[];

    const source: SourceRecord = {
      id: row.id,
      xref: row.xref ?? undefined,
      title: row.title ?? undefined,
      abbreviation: row.abbreviation ?? undefined,
      author: row.author ?? undefined,
      publication: row.publication ?? undefined,
      medium: row.medium ?? undefined,
      url: row.url ?? undefined,
      accessDate: row.access_date ?? undefined,
      confidence: row.confidence ?? undefined,
      pubDate: row.pub_date_id !== null ? datesById.get(row.pub_date_id) : undefined,
      pubPlace: row.pub_place_text ?? undefined,
      agency: row.agency ?? undefined,
      titleId: row.title_id ?? undefined,
    };
    if (texts.length > 0) {
      source.texts = texts.map((text) => ({
        id: text.id,
        text: text.text,
        mime: text.mime ?? undefined,
        language: text.language ?? undefined,
      }));
    }
    if (events.length > 0) {
      source.dataEvents = events.map((event) => {
        const date = event.date_id !== null ? datesById.get(event.date_id) : undefined;
        return {
          id: event.id,
          tag: event.tag,
          ...(event.value !== null ? { value: event.value } : {}),
          ...(date !== undefined ? { date } : {}),
          ...(event.place_id !== null ? { placeId: event.place_id } : {}),
        };
      });
    }
    if (repositories.length > 0) {
      source.repositories = repositories.map((repository) => {
        const callNumbers = this.db
          .prepare('SELECT id, value, medium FROM call_number WHERE source_repository_id = ? ORDER BY id')
          .all(repository.id) as unknown as { id: string; value: string; medium: string | null }[];
        return {
          id: repository.id,
          repositoryId: repository.repository_id,
          callNumbers: callNumbers.map((callNumber) => ({
            id: callNumber.id,
            value: callNumber.value,
            ...(callNumber.medium !== null ? { medium: callNumber.medium } : {}),
          })),
        };
      });
    }
    if (fields.length > 0) {
      source.templateFields = fields.map((field) => ({
        id: field.id,
        name: field.name,
        ...(field.value !== null ? { value: field.value } : {}),
      }));
    }
    return source;
  }

  private listSourceEventDateIds(sourceId: string): Array<string | null> {
    const rows = this.db
      .prepare('SELECT date_id FROM source_data_event WHERE source_id = ? AND date_id IS NOT NULL')
      .all(sourceId) as unknown as { date_id: string }[];
    return rows.map((row) => row.date_id);
  }

  private hydrateCitation(row: CitationRow): CitationRecord {
    const datesById = this.dates.getMany([row.date_id].filter((id): id is string => id !== null));
    const texts = this.db
      .prepare('SELECT id, text, mime, language FROM citation_text WHERE citation_id = ? ORDER BY id')
      .all(row.id) as unknown as { id: string; text: string; mime: string | null; language: string | null }[];
    const fields = this.db
      .prepare('SELECT id, name, value FROM citation_template_field WHERE citation_id = ? ORDER BY position')
      .all(row.id) as unknown as { id: string; name: string; value: string | null }[];
    const citation: CitationRecord = {
      id: row.id,
      sourceId: row.source_id,
      targetType: row.target_type,
      targetId: row.target_id,
      description: row.description ?? undefined,
      page: row.page ?? undefined,
      quality: row.quality ?? undefined,
      confidence: row.confidence ?? undefined,
      event: row.event ?? undefined,
      role: row.role ?? undefined,
      phrase: row.phrase ?? undefined,
      date: row.date_id !== null ? datesById.get(row.date_id) : undefined,
      www: row.www ?? undefined,
    };
    if (texts.length > 0) {
      citation.texts = texts.map((text) => ({
        id: text.id,
        text: text.text,
        mime: text.mime ?? undefined,
        language: text.language ?? undefined,
      }));
    }
    if (fields.length > 0) {
      citation.templateFields = fields.map((field) => ({
        id: field.id,
        name: field.name,
        ...(field.value !== null ? { value: field.value } : {}),
      }));
    }
    return citation;
  }
}

const sourceSelect = `SELECT id, xref, title, abbreviation, author, publication,
  medium, url, access_date, confidence, pub_date_id, pub_place_text, agency, title_id
  FROM source`;

const citationSelect = `SELECT id, source_id, target_type, target_id, description, page, quality,
  confidence, event, role, phrase, date_id, www
  FROM citation`;

function sourceParams(source: SourceRecord, dates: DateRepo): Array<string | number | null> {
  return [
    source.id,
    source.xref ?? null,
    source.title ?? null,
    source.abbreviation ?? null,
    source.author ?? null,
    source.publication ?? null,
    source.medium ?? null,
    source.url ?? null,
    source.accessDate ?? null,
    source.confidence ?? null,
    source.pubDate ? dates.upsert(source.pubDate) : null,
    source.pubPlace ?? null,
    source.agency ?? null,
    source.titleId ?? null,
  ];
}

function citationParams(citation: CitationRecord, dates: DateRepo): Array<string | number | null> {
  return [
    citation.id,
    citation.sourceId,
    citation.targetType,
    citation.targetId,
    citation.description ?? null,
    citation.page ?? null,
    citation.quality ?? null,
    citation.confidence ?? null,
    citation.event ?? null,
    citation.role ?? null,
    citation.phrase ?? null,
    citation.date ? dates.upsert(citation.date) : null,
    citation.www ?? null,
  ];
}
