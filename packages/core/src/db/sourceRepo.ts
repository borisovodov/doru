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
  pub_place_text: string | null;
  agency: string | null;
  title_id: string | null;
  certainty: string | null;
  subsequent_citation_format: string | null;
  bibliography: string | null;
  data_note: string | null;
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
  www: string | null;
  name: string | null;
  quality_assessment: string | null;
  reference: string | null;
  reference_number: string | null;
  abbreviation: string | null;
  footnote: string | null;
  verified: number;
  assessment: string | null;
  found_by: string | null;
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
           medium, url, access_date, confidence, pub_place_text, agency, title_id,
           certainty, subsequent_citation_format, bibliography, data_note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(...sourceParams(source));
    this.dates.upsertForOwner('source', source.id, 'publication', source.pubDate);
    this.replaceSourceDetails(source);
  }

  updateSource(source: SourceRecord): void {
    if (this.db.prepare('SELECT 1 FROM source WHERE id = ?').get(source.id) === undefined) {
      throw new Error(`source ${source.id} no longer exists`);
    }
    this.db
      .prepare(
        `UPDATE source SET xref = ?, title = ?, abbreviation = ?, author = ?, publication = ?,
           medium = ?, url = ?, access_date = ?, confidence = ?, pub_place_text = ?,
           agency = ?, title_id = ?, certainty = ?, subsequent_citation_format = ?, bibliography = ?,
           data_note = ?
         WHERE id = ?`,
      )
      .run(...sourceParams(source).slice(1), source.id);
    this.dates.upsertForOwner('source', source.id, 'publication', source.pubDate);
    this.replaceSourceDetails(source);
  }

  /** Reconnects a surviving source data event to its place. */
  setDataEventPlaceId(eventId: string, placeId: string | undefined): void {
    this.db
      .prepare('UPDATE source_data_event SET place_id = ? WHERE id = ? AND place_id IS NULL')
      .run(placeId ?? null, eventId);
  }

  deleteSource(id: string): boolean {
    // Citation and source-data-event rows cascade with the source; their
    // owner triggers delete the date rows with them.
    return this.db.prepare('DELETE FROM source WHERE id = ?').run(id).changes > 0;
  }

  getSource(id: string): SourceRecord | undefined {
    const row = this.db.prepare(`${sourceSelect} WHERE id = ?`).get(id) as SourceRow | undefined;
    return row ? this.hydrate(row) : undefined;
  }

  listSources(): SourceRecord[] {
    const rows = this.db.prepare(`${sourceSelect} ORDER BY id`).all() as unknown as SourceRow[];
    return rows.map((row) => this.hydrate(row));
  }

  /**
   * The source→repository links of one repository with their call numbers,
   * for the delete/undo snapshot. The FK cascade removes them with the
   * repository.
   */
  listSourceRepositoriesFor(repositoryId: string): Array<{
    id: string;
    sourceId: string;
    repositoryId: string;
    callNumbers: Array<{ id: string; value: string; medium?: string }>;
  }> {
    const rows = this.db
      .prepare('SELECT id, source_id, repository_id FROM source_repository WHERE repository_id = ? ORDER BY id')
      .all(repositoryId) as unknown as { id: string; source_id: string; repository_id: string }[];
    const callNumbers = this.db.prepare(
      'SELECT id, value, medium FROM call_number WHERE source_repository_id = ? ORDER BY id',
    );
    return rows.map((row) => {
      const numbers = callNumbers.all(row.id) as unknown as { id: string; value: string; medium: string | null }[];
      return {
        id: row.id,
        sourceId: row.source_id,
        repositoryId: row.repository_id,
        callNumbers: numbers.map((number) => ({
          id: number.id,
          value: number.value,
          ...(number.medium !== null ? { medium: number.medium } : {}),
        })),
      };
    });
  }

  /** Re-inserts a source→repository link and its call numbers after an undo. */
  restoreSourceRepository(link: {
    id: string;
    sourceId: string;
    repositoryId: string;
    callNumbers?: Array<{ id: string; value: string; medium?: string }>;
  }): void {
    this.db
      .prepare('INSERT INTO source_repository (id, source_id, repository_id) VALUES (?, ?, ?)')
      .run(link.id, link.sourceId, link.repositoryId);
    const insert = this.db.prepare(
      'INSERT INTO call_number (id, source_repository_id, value, medium) VALUES (?, ?, ?, ?)',
    );
    for (const callNumber of link.callNumbers ?? []) {
      insert.run(callNumber.id, link.id, callNumber.value, callNumber.medium ?? null);
    }
  }

  /** Sources citing a bibliographic title, for the title delete/undo snapshot. */
  listSourcesForTitle(titleId: string): Array<{ id: string; titleId: string }> {
    const rows = this.db
      .prepare('SELECT id, title_id FROM source WHERE title_id = ? ORDER BY id')
      .all(titleId) as unknown as { id: string; title_id: string }[];
    return rows.map((row) => ({ id: row.id, titleId: row.title_id }));
  }

  setSourceTitle(sourceId: string, titleId: string | undefined): void {
    this.db.prepare('UPDATE source SET title_id = ? WHERE id = ? AND title_id IS NULL').run(titleId ?? null, sourceId);
  }

  addSourceCitation(sourceId: string, targetType: string, targetId: string): void {
    this.insertCitation({ id: crypto.randomUUID(), sourceId, targetType, targetId });
  }

  insertCitation(citation: CitationRecord): void {
    this.db
      .prepare(
        `INSERT INTO citation (id, source_id, target_type, target_id, description, page, quality,
           confidence, event, role, phrase, www, name, quality_assessment, reference,
           reference_number, abbreviation, footnote, verified, assessment, found_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(...citationParams(citation));
    this.dates.upsertForOwner('citation', citation.id, 'date', citation.date);
    this.replaceCitationDetails(citation);
  }

  updateCitation(citation: CitationRecord): void {
    if (this.db.prepare('SELECT 1 FROM citation WHERE id = ?').get(citation.id) === undefined) {
      throw new Error(`citation ${citation.id} no longer exists`);
    }
    this.db
      .prepare(
        `UPDATE citation SET source_id = ?, target_type = ?, target_id = ?, description = ?, page = ?,
           quality = ?, confidence = ?, event = ?, role = ?, phrase = ?, www = ?,
           name = ?, quality_assessment = ?, reference = ?, reference_number = ?, abbreviation = ?,
           footnote = ?, verified = ?, assessment = ?, found_by = ?
         WHERE id = ?`,
      )
      .run(...citationParams(citation).slice(1), citation.id);
    this.dates.upsertForOwner('citation', citation.id, 'date', citation.date);
    this.replaceCitationDetails(citation);
  }

  deleteCitation(id: string): boolean {
    return this.db.prepare('DELETE FROM citation WHERE id = ?').run(id).changes > 0;
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
    return rows.flatMap((row) => {
      const source = this.getSource(row.source_id);
      return source === undefined ? [] : [{ id: row.id, source }];
    });
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

  /** Deletes every citation of the target; owner triggers delete their dates. */
  deleteCitationsFor(targetType: string, targetId: string): void {
    this.db.prepare('DELETE FROM citation WHERE target_type = ? AND target_id = ?').run(targetType, targetId);
  }

  private replaceSourceDetails(source: SourceRecord): void {
    const eventIds = (
      this.db.prepare('SELECT id FROM source_data_event WHERE source_id = ?').all(source.id) as unknown as Array<{
        id: string;
      }>
    ).map((row) => row.id);
    const reservedEventDates = this.dates.reservationsFor('source_data_event', eventIds);
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
      'INSERT INTO source_data_event (id, source_id, tag, value, place_id) VALUES (?, ?, ?, ?, ?)',
    );
    for (const event of source.dataEvents ?? []) {
      insertEvent.run(event.id, source.id, event.tag, event.value ?? null, event.placeId ?? null);
      this.dates.upsertForOwner('source_data_event', event.id, 'date', event.date, reservedEventDates);
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
    const events = this.db
      .prepare('SELECT id, tag, value, place_id FROM source_data_event WHERE source_id = ? ORDER BY id')
      .all(row.id) as unknown as {
      id: string;
      tag: string;
      value: string | null;
      place_id: string | null;
    }[];
    const eventDates = this.dates.getManyForOwners(
      'source_data_event',
      events.map((event) => event.id),
    );
    const texts = this.db
      .prepare('SELECT id, text, mime, language FROM source_text WHERE source_id = ? ORDER BY id')
      .all(row.id) as unknown as { id: string; text: string; mime: string | null; language: string | null }[];
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
      pubDate: this.dates.getForOwner('source', row.id, 'publication'),
      pubPlace: row.pub_place_text ?? undefined,
      agency: row.agency ?? undefined,
      titleId: row.title_id ?? undefined,
      certainty: row.certainty ?? undefined,
      subsequentCitationFormat: row.subsequent_citation_format ?? undefined,
      bibliography: row.bibliography ?? undefined,
      dataNote: row.data_note ?? undefined,
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
        const date = eventDates.get(event.id)?.get('date');
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

  private hydrateCitation(row: CitationRow): CitationRecord {
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
      date: this.dates.getForOwner('citation', row.id, 'date'),
      www: row.www ?? undefined,
      name: row.name ?? undefined,
      qualityAssessment: row.quality_assessment ?? undefined,
      reference: row.reference ?? undefined,
      referenceNumber: row.reference_number ?? undefined,
      abbreviation: row.abbreviation ?? undefined,
      footnote: row.footnote ?? undefined,
      verified: row.verified === 1 ? true : undefined,
      assessment: row.assessment ?? undefined,
      foundBy: row.found_by ?? undefined,
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
  medium, url, access_date, confidence, pub_place_text, agency, title_id,
  certainty, subsequent_citation_format, bibliography, data_note
  FROM source`;

const citationSelect = `SELECT id, source_id, target_type, target_id, description, page, quality,
  confidence, event, role, phrase, www, name, quality_assessment, reference,
  reference_number, abbreviation, footnote, verified, assessment, found_by
  FROM citation`;

function sourceParams(source: SourceRecord): Array<string | number | null> {
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
    source.pubPlace ?? null,
    source.agency ?? null,
    source.titleId ?? null,
    source.certainty ?? null,
    source.subsequentCitationFormat ?? null,
    source.bibliography ?? null,
    source.dataNote ?? null,
  ];
}

function citationParams(citation: CitationRecord): Array<string | number | null> {
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
    citation.www ?? null,
    citation.name ?? null,
    citation.qualityAssessment ?? null,
    citation.reference ?? null,
    citation.referenceNumber ?? null,
    citation.abbreviation ?? null,
    citation.footnote ?? null,
    citation.verified ? 1 : 0,
    citation.assessment ?? null,
    citation.foundBy ?? null,
  ];
}
