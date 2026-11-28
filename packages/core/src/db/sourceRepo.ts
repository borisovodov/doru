import type { DatabaseSync } from 'node:sqlite';
import type { CitationRecord, SourceRecord } from '../model/types';
import { dateOwnerKey, type DateRepo, type DateReservations, type DateSlotReservation } from './dateRepo';
import type { TransactionScope } from './transaction';

interface SourceRow {
  id: string;
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
  text: string | null;
  publication_date_id: string | null;
  created_at: number | null;
  updated_at: number | null;
}

interface CitationRow {
  id: string;
  source_id: string;
  target_type: string;
  target_id: string;
  description: string | null;
  page: string | null;
  text: string | null;
  quality: string | null;
  confidence: string | null;
  event: string | null;
  role: string | null;
  phrase: string | null;
  www: string | null;
  name: string | null;
  quality_assessment: string | null;
  reference: string | null;
  abbreviation: string | null;
  footnote: string | null;
  verified: number;
  assessment: string | null;
  found_by: string | null;
  created_at: number | null;
  updated_at: number | null;
  date_id: string | null;
}

/**
 * Sources (with their text, data events, repository links and call numbers)
 * and citations (with their single source-extract text and timestamps).
 */
export class SourceRepo {
  constructor(
    private readonly db: DatabaseSync,
    private readonly dates: DateRepo,
    private readonly transactions: TransactionScope,
  ) {}

  insertSource(source: SourceRecord): void {
    this.transactions.run(() => {
      const publicationDateId = source.pubDate !== undefined ? this.dates.create(source.pubDate) : null;
      this.db
        .prepare(
          `INSERT INTO source (id, title, abbreviation, author, publication,
             medium, url, access_date, confidence, pub_place_text, agency, title_id,
             certainty, subsequent_citation_format, bibliography, data_note, text,
             created_at, updated_at, publication_date_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(...sourceParams(source), publicationDateId);
      this.replaceSourceDetails(source);
    });
  }

  updateSource(source: SourceRecord): void {
    this.transactions.run(() => {
      const current = this.db.prepare('SELECT publication_date_id FROM source WHERE id = ?').get(source.id) as
        | { publication_date_id: string | null }
        | undefined;
      if (current === undefined) {
        throw new Error(`source ${source.id} no longer exists`);
      }
      const eventRows = this.db
        .prepare('SELECT id, date_id FROM source_data_event WHERE source_id = ?')
        .all(source.id) as unknown as Array<{ id: string; date_id: string | null }>;
      const reservedDates = sourceDateReservations(source.id, current.publication_date_id, eventRows);
      const prepared = this.dates.prepareSlots(
        [current.publication_date_id],
        [source.pubDate],
        [sourcePublicationReservation(source.id, reservedDates)],
      );
      this.db
        .prepare(
          `UPDATE source SET title = ?, abbreviation = ?, author = ?, publication = ?,
             medium = ?, url = ?, access_date = ?, confidence = ?, pub_place_text = ?,
             agency = ?, title_id = ?, certainty = ?, subsequent_citation_format = ?, bibliography = ?,
             data_note = ?, text = ?, created_at = ?, updated_at = ?, publication_date_id = ?
           WHERE id = ?`,
        )
        .run(...sourceParams(source).slice(1), prepared.ids[0] ?? null, source.id);
      this.replaceSourceDetails(source, reservedDates);
      this.dates.deleteMany(prepared.obsolete);
    });
  }

  /** Reconnects a surviving source data event to its place. */
  setDataEventPlaceId(eventId: string, placeId: string | undefined): void {
    this.db
      .prepare('UPDATE source_data_event SET place_id = ? WHERE id = ? AND place_id IS NULL')
      .run(placeId ?? null, eventId);
  }

  deleteSource(id: string): boolean {
    // Citation and source-data-event rows cascade with the source; their
    // dates are collected before the delete and removed afterwards.
    return this.transactions.run(() => {
      const dates = this.db
        .prepare(
          `SELECT publication_date_id AS date_id FROM source WHERE id = ?
           UNION ALL
           SELECT date_id FROM source_data_event WHERE source_id = ?
           UNION ALL
           SELECT date_id FROM citation WHERE source_id = ?`,
        )
        .all(id, id, id) as unknown as Array<{ date_id: string | null }>;
      const changed = this.db.prepare('DELETE FROM source WHERE id = ?').run(id).changes > 0;
      if (changed) {
        this.dates.deleteMany(dates.map((row) => row.date_id));
      }
      return changed;
    });
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
    const now = Date.now();
    this.insertCitation({ id: crypto.randomUUID(), sourceId, targetType, targetId, createdAt: now, updatedAt: now });
  }

  insertCitation(citation: CitationRecord): void {
    this.transactions.run(() => {
      const dateId = citation.date !== undefined ? this.dates.create(citation.date) : null;
      this.db
        .prepare(
          `INSERT INTO citation (id, source_id, target_type, target_id, description, page, text, quality,
             confidence, event, role, phrase, www, name, quality_assessment, reference,
             abbreviation, footnote, verified, assessment, found_by, created_at, updated_at, date_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(...citationParams(citation), dateId);
    });
  }

  updateCitation(citation: CitationRecord): void {
    this.transactions.run(() => {
      const current = this.db.prepare('SELECT date_id FROM citation WHERE id = ?').get(citation.id) as
        | { date_id: string | null }
        | undefined;
      if (current === undefined) {
        throw new Error(`citation ${citation.id} no longer exists`);
      }
      const prepared = this.dates.prepareSlots([current.date_id], [citation.date]);
      this.db
        .prepare(
          `UPDATE citation SET source_id = ?, target_type = ?, target_id = ?, description = ?, page = ?,
             text = ?, quality = ?, confidence = ?, event = ?, role = ?, phrase = ?, www = ?,
             name = ?, quality_assessment = ?, reference = ?, abbreviation = ?,
             footnote = ?, verified = ?, assessment = ?, found_by = ?, created_at = ?, updated_at = ?, date_id = ?
           WHERE id = ?`,
        )
        .run(...citationParams(citation).slice(1), prepared.ids[0] ?? null, citation.id);
      this.dates.deleteMany(prepared.obsolete);
    });
  }

  deleteCitation(id: string): boolean {
    return this.transactions.run(() => {
      const current = this.db.prepare('SELECT date_id FROM citation WHERE id = ?').get(id) as
        | { date_id: string | null }
        | undefined;
      const changed = this.db.prepare('DELETE FROM citation WHERE id = ?').run(id).changes > 0;
      if (changed) {
        this.dates.deleteMany([current?.date_id]);
      }
      return changed;
    });
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

  /** Deletes every citation of the target and the dates they owned. */
  deleteCitationsFor(targetType: string, targetId: string): void {
    this.transactions.run(() => {
      const rows = this.db
        .prepare('SELECT date_id FROM citation WHERE target_type = ? AND target_id = ?')
        .all(targetType, targetId) as unknown as Array<{ date_id: string | null }>;
      const changed = this.db
        .prepare('DELETE FROM citation WHERE target_type = ? AND target_id = ?')
        .run(targetType, targetId).changes;
      if (changed > 0) {
        this.dates.deleteMany(rows.map((row) => row.date_id));
      }
    });
  }

  private replaceSourceDetails(source: SourceRecord, reservedDates?: DateReservations): void {
    const eventRows = this.db
      .prepare('SELECT id, date_id FROM source_data_event WHERE source_id = ?')
      .all(source.id) as unknown as Array<{ id: string; date_id: string | null }>;
    const eventReservations = reservedDates ?? sourceDataEventReservations(eventRows);
    this.db.prepare('DELETE FROM source_data_event WHERE source_id = ?').run(source.id);
    this.db.prepare('DELETE FROM source_repository WHERE source_id = ?').run(source.id);
    this.dates.deleteMany(eventRows.map((row) => row.date_id));

    const insertEvent = this.db.prepare(
      'INSERT INTO source_data_event (id, source_id, tag, value, place_id, date_id) VALUES (?, ?, ?, ?, ?, ?)',
    );
    for (const event of source.dataEvents ?? []) {
      const dateId =
        event.date !== undefined
          ? this.dates.create(event.date, {
              ownerKey: dateOwnerKey('source_data_event', event.id),
              reserved: eventReservations,
            })
          : null;
      insertEvent.run(event.id, source.id, event.tag, event.value ?? null, event.placeId ?? null, dateId);
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
  }

  private hydrate(row: SourceRow): SourceRecord {
    const events = this.db
      .prepare('SELECT id, tag, value, place_id, date_id FROM source_data_event WHERE source_id = ? ORDER BY id')
      .all(row.id) as unknown as {
      id: string;
      tag: string;
      value: string | null;
      place_id: string | null;
      date_id: string | null;
    }[];
    const eventDates = this.dates.getMany(events.map((event) => event.date_id));
    const repositories = this.db
      .prepare('SELECT id, repository_id FROM source_repository WHERE source_id = ? ORDER BY id')
      .all(row.id) as unknown as { id: string; repository_id: string }[];

    const source: SourceRecord = {
      id: row.id,
      title: row.title ?? undefined,
      abbreviation: row.abbreviation ?? undefined,
      author: row.author ?? undefined,
      publication: row.publication ?? undefined,
      medium: row.medium ?? undefined,
      url: row.url ?? undefined,
      accessDate: row.access_date ?? undefined,
      confidence: row.confidence ?? undefined,
      pubDate: row.publication_date_id !== null ? this.dates.get(row.publication_date_id) : undefined,
      pubPlace: row.pub_place_text ?? undefined,
      agency: row.agency ?? undefined,
      titleId: row.title_id ?? undefined,
      certainty: row.certainty ?? undefined,
      subsequentCitationFormat: row.subsequent_citation_format ?? undefined,
      bibliography: row.bibliography ?? undefined,
      dataNote: row.data_note ?? undefined,
      text: row.text ?? undefined,
      createdAt: row.created_at ?? undefined,
      updatedAt: row.updated_at ?? undefined,
    };
    if (events.length > 0) {
      source.dataEvents = events.map((event) => {
        const date = event.date_id !== null ? eventDates.get(event.date_id) : undefined;
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
    return source;
  }

  private hydrateCitation(row: CitationRow): CitationRecord {
    return {
      id: row.id,
      sourceId: row.source_id,
      targetType: row.target_type,
      targetId: row.target_id,
      description: row.description ?? undefined,
      page: row.page ?? undefined,
      text: row.text ?? undefined,
      quality: row.quality ?? undefined,
      confidence: row.confidence ?? undefined,
      event: row.event ?? undefined,
      role: row.role ?? undefined,
      phrase: row.phrase ?? undefined,
      date: row.date_id !== null ? this.dates.get(row.date_id) : undefined,
      www: row.www ?? undefined,
      name: row.name ?? undefined,
      qualityAssessment: row.quality_assessment ?? undefined,
      reference: row.reference ?? undefined,
      abbreviation: row.abbreviation ?? undefined,
      footnote: row.footnote ?? undefined,
      verified: row.verified === 1 ? true : undefined,
      assessment: row.assessment ?? undefined,
      foundBy: row.found_by ?? undefined,
      createdAt: row.created_at ?? undefined,
      updatedAt: row.updated_at ?? undefined,
    };
  }
}

const sourceSelect = `SELECT id, title, abbreviation, author, publication,
  medium, url, access_date, confidence, pub_place_text, agency, title_id,
  certainty, subsequent_citation_format, bibliography, data_note, text,
  created_at, updated_at, publication_date_id
  FROM source`;

const citationSelect = `SELECT id, source_id, target_type, target_id, description, page, text, quality,
  confidence, event, role, phrase, www, name, quality_assessment, reference,
  abbreviation, footnote, verified, assessment, found_by, created_at, updated_at, date_id
  FROM citation`;

function sourceDataEventReservations(rows: Array<{ id: string; date_id: string | null }>): DateReservations {
  const reserved = new Map<string, string>();
  for (const row of rows) {
    if (row.date_id !== null) {
      reserved.set(row.date_id, dateOwnerKey('source_data_event', row.id));
    }
  }
  return reserved;
}

function sourceDateReservations(
  sourceId: string,
  publicationDateId: string | null,
  eventRows: Array<{ id: string; date_id: string | null }>,
): DateReservations {
  const reserved = new Map(sourceDataEventReservations(eventRows));
  if (publicationDateId !== null) {
    reserved.set(publicationDateId, dateOwnerKey('source', sourceId, 'publication'));
  }
  return reserved;
}

function sourcePublicationReservation(sourceId: string, reservedDates: DateReservations): DateSlotReservation {
  return { ownerKey: dateOwnerKey('source', sourceId, 'publication'), reserved: reservedDates };
}

function sourceParams(source: SourceRecord): Array<string | number | null> {
  return [
    source.id,
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
    source.text ?? null,
    source.createdAt ?? null,
    source.updatedAt ?? null,
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
    citation.text ?? null,
    citation.quality ?? null,
    citation.confidence ?? null,
    citation.event ?? null,
    citation.role ?? null,
    citation.phrase ?? null,
    citation.www ?? null,
    citation.name ?? null,
    citation.qualityAssessment ?? null,
    citation.reference ?? null,
    citation.abbreviation ?? null,
    citation.footnote ?? null,
    citation.verified ? 1 : 0,
    citation.assessment ?? null,
    citation.foundBy ?? null,
    citation.createdAt ?? null,
    citation.updatedAt ?? null,
  ];
}
