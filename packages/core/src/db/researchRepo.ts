import type { DatabaseSync } from 'node:sqlite';
import type {
  CensusRecord,
  DuplicateCandidateRecord,
  EvidenceFinding,
  EvidenceLinkRecord,
  EvidenceRecord,
  ResearchActivityRecord,
  ResearchConclusion,
  ResearchDocumentRecord,
  TitleRecord,
  TodoRecord,
} from '../model/types';
import type { DateRepo } from './dateRepo';

/** The research layer: todos, evidence, research documents/activities, censuses, duplicates, titles. */
export class ResearchRepo {
  constructor(
    private readonly db: DatabaseSync,
    private readonly dates: DateRepo,
  ) {}

  // todos -----------------------------------------------------------------------

  insertTodo(todo: TodoRecord): void {
    this.db
      .prepare(
        `INSERT INTO todo (id, text, target_type, target_id, category, locality, priority, status,
           created_date_id, scheduled_date_id, reminder_date_id, closed_date_id, repository_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(...todoParams(todo, this.dates));
  }

  updateTodo(todo: TodoRecord): void {
    this.db
      .prepare(
        `UPDATE todo SET text = ?, target_type = ?, target_id = ?, category = ?, locality = ?, priority = ?,
           status = ?, created_date_id = ?, scheduled_date_id = ?, reminder_date_id = ?, closed_date_id = ?, repository_id = ?
         WHERE id = ?`,
      )
      .run(...todoParams(todo, this.dates).slice(1), todo.id);
  }

  deleteTodo(id: string): boolean {
    const row = this.db
      .prepare(
        'SELECT created_date_id, scheduled_date_id, reminder_date_id, closed_date_id FROM todo WHERE id = ?',
      )
      .get(id) as
      | { created_date_id: string | null; scheduled_date_id: string | null; reminder_date_id: string | null; closed_date_id: string | null }
      | undefined;
    const result = this.db.prepare('DELETE FROM todo WHERE id = ?').run(id);
    if (row) {
      for (const dateId of [row.created_date_id, row.scheduled_date_id, row.reminder_date_id, row.closed_date_id]) {
        if (dateId !== null) {
          this.dates.delete(dateId);
        }
      }
    }
    return result.changes > 0;
  }

  listTodos(): TodoRecord[] {
    const rows = this.db.prepare(todoSelect).all() as unknown as TodoRow[];
    return rows.map((row) => this.hydrateTodo(row));
  }

  listTodosFor(targetType: string, targetId: string): TodoRecord[] {
    const rows = this.db
      .prepare(`${todoSelect} WHERE target_type = ? AND target_id = ? ORDER BY id`)
      .all(targetType, targetId) as unknown as TodoRow[];
    return rows.map((row) => this.hydrateTodo(row));
  }

  deleteTodosFor(targetType: string, targetId: string): void {
    const rows = this.db
      .prepare(
        `SELECT id, created_date_id, scheduled_date_id, reminder_date_id, closed_date_id
         FROM todo WHERE target_type = ? AND target_id = ?`,
      )
      .all(targetType, targetId) as unknown as {
      id: string;
      created_date_id: string | null;
      scheduled_date_id: string | null;
      reminder_date_id: string | null;
      closed_date_id: string | null;
    }[];
    this.db.prepare('DELETE FROM todo WHERE target_type = ? AND target_id = ?').run(targetType, targetId);
    for (const row of rows) {
      for (const dateId of [row.created_date_id, row.scheduled_date_id, row.reminder_date_id, row.closed_date_id]) {
        if (dateId !== null) {
          this.dates.delete(dateId);
        }
      }
    }
  }

  private hydrateTodo(row: TodoRow): TodoRecord {
    const datesById = this.dates.getMany(
      [row.created_date_id, row.scheduled_date_id, row.reminder_date_id, row.closed_date_id].filter(
        (id): id is string => id !== null,
      ),
    );
    return {
      id: row.id,
      text: row.text,
      targetType: row.target_type ?? undefined,
      targetId: row.target_id ?? undefined,
      category: row.category ?? undefined,
      locality: row.locality ?? undefined,
      priority: row.priority ?? undefined,
      status: row.status ?? undefined,
      createdDate: row.created_date_id !== null ? datesById.get(row.created_date_id) : undefined,
      scheduledDate: row.scheduled_date_id !== null ? datesById.get(row.scheduled_date_id) : undefined,
      reminderDate: row.reminder_date_id !== null ? datesById.get(row.reminder_date_id) : undefined,
      closedDate: row.closed_date_id !== null ? datesById.get(row.closed_date_id) : undefined,
      repositoryId: row.repository_id ?? undefined,
    };
  }

  // evidence ----------------------------------------------------------------------

  insertEvidence(evidence: EvidenceRecord): void {
    this.db
      .prepare('INSERT INTO evidence (id, type, document_type, analysis) VALUES (?, ?, ?, ?)')
      .run(evidence.id, evidence.type ?? null, evidence.documentType ?? null, evidence.analysis ?? null);
    this.replaceEvidenceDetails(evidence);
  }

  updateEvidence(evidence: EvidenceRecord): void {
    this.db
      .prepare('UPDATE evidence SET type = ?, document_type = ?, analysis = ? WHERE id = ?')
      .run(evidence.type ?? null, evidence.documentType ?? null, evidence.analysis ?? null, evidence.id);
    this.replaceEvidenceDetails(evidence);
  }

  deleteEvidence(id: string): boolean {
    const rows = this.db
      .prepare('SELECT id, date_id FROM evidence_finding WHERE evidence_id = ?')
      .all(id) as unknown as { id: string; date_id: string | null }[];
    const result = this.db.prepare('DELETE FROM evidence WHERE id = ?').run(id);
    for (const row of rows) {
      if (row.date_id !== null) {
        this.dates.delete(row.date_id);
      }
    }
    return result.changes > 0;
  }

  getEvidence(id: string): EvidenceRecord | undefined {
    const row = this.db
      .prepare('SELECT id, type, document_type, analysis FROM evidence WHERE id = ?')
      .get(id) as EvidenceRow | undefined;
    return row ? this.hydrateEvidence(row) : undefined;
  }

  listEvidence(): EvidenceRecord[] {
    const rows = this.db
      .prepare('SELECT id, type, document_type, analysis FROM evidence ORDER BY id')
      .all() as unknown as EvidenceRow[];
    return rows.map((row) => this.hydrateEvidence(row));
  }

  /** The evidence links targeting the given target, with their evidence records. */
  listEvidenceLinksFor(targetType: string, targetId: string): EvidenceLinkRecord[] {
    const rows = this.db
      .prepare(
        `SELECT id, evidence_id, target_type, target_id, confidence, used, quality
         FROM evidence_link WHERE target_type = ? AND target_id = ? ORDER BY id`,
      )
      .all(targetType, targetId) as unknown as LinkRow[];
    return rows.map(rowToLink);
  }

  insertEvidenceLink(link: EvidenceLinkRecord): void {
    this.db
      .prepare(
        `INSERT INTO evidence_link (id, evidence_id, target_type, target_id, confidence, used, quality)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(link.id, link.evidenceId, link.targetType, link.targetId, link.confidence ?? null, link.used ?? null, link.quality ?? null);
  }

  deleteEvidenceLinksFor(targetType: string, targetId: string): void {
    this.db.prepare('DELETE FROM evidence_link WHERE target_type = ? AND target_id = ?').run(targetType, targetId);
  }

  private replaceEvidenceDetails(evidence: EvidenceRecord): void {
    this.db.prepare('DELETE FROM evidence_finding WHERE evidence_id = ?').run(evidence.id);
    this.db.prepare('DELETE FROM evidence_link WHERE evidence_id = ?').run(evidence.id);
    const insertFinding = this.db.prepare(
      `INSERT INTO evidence_finding (id, evidence_id, type, value, date_id, place_id,
         age_bound, age_years, age_months, age_days, age_phrase)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const finding of evidence.findings) {
      insertFinding.run(
        finding.id,
        evidence.id,
        finding.type ?? null,
        finding.value ?? null,
        finding.date ? this.dates.upsert(finding.date) : null,
        finding.placeId ?? null,
        finding.ageBound ?? null,
        finding.ageYears ?? null,
        finding.ageMonths ?? null,
        finding.ageDays ?? null,
        finding.agePhrase ?? null,
      );
    }
    const insertLink = this.db.prepare(
      `INSERT INTO evidence_link (id, evidence_id, target_type, target_id, confidence, used, quality)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const link of evidence.links) {
      insertLink.run(link.id, evidence.id, link.targetType, link.targetId, link.confidence ?? null, link.used ?? null, link.quality ?? null);
    }
  }

  private hydrateEvidence(row: EvidenceRow): EvidenceRecord {
    const findingRows = this.db
      .prepare(
        `SELECT id, evidence_id, type, value, date_id, place_id, age_bound, age_years, age_months, age_days, age_phrase
         FROM evidence_finding WHERE evidence_id = ? ORDER BY id`,
      )
      .all(row.id) as unknown as FindingRow[];
    const dateIds = findingRows.map((finding) => finding.date_id).filter((id): id is string => id !== null);
    const datesById = this.dates.getMany(dateIds);
    const links = this.db
      .prepare(
        `SELECT id, evidence_id, target_type, target_id, confidence, used, quality
         FROM evidence_link WHERE evidence_id = ? ORDER BY id`,
      )
      .all(row.id) as unknown as LinkRow[];
    const findings: EvidenceFinding[] = findingRows.map((finding) => {
      const date = finding.date_id !== null ? datesById.get(finding.date_id) : undefined;
      return {
        id: finding.id,
        type: finding.type ?? undefined,
        value: finding.value ?? undefined,
        ...(date !== undefined ? { date } : {}),
        placeId: finding.place_id ?? undefined,
        ageBound: finding.age_bound ?? undefined,
        ageYears: finding.age_years ?? undefined,
        ageMonths: finding.age_months ?? undefined,
        ageDays: finding.age_days ?? undefined,
        agePhrase: finding.age_phrase ?? undefined,
      };
    });
    return {
      id: row.id,
      type: row.type ?? undefined,
      documentType: row.document_type ?? undefined,
      analysis: row.analysis ?? undefined,
      findings,
      links: links.map(rowToLink),
    };
  }

  // research documents and activities ----------------------------------------------

  insertResearchDocument(document: ResearchDocumentRecord): void {
    this.db
      .prepare('INSERT INTO research_document (id, title, text, author, date_id) VALUES (?, ?, ?, ?, ?)')
      .run(
        document.id,
        document.title ?? null,
        document.text,
        document.author ?? null,
        document.date ? this.dates.upsert(document.date) : null,
      );
    this.replaceDocumentDetails(document);
  }

  updateResearchDocument(document: ResearchDocumentRecord): void {
    this.db
      .prepare('UPDATE research_document SET title = ?, text = ?, author = ?, date_id = ? WHERE id = ?')
      .run(
        document.title ?? null,
        document.text,
        document.author ?? null,
        document.date ? this.dates.upsert(document.date) : null,
        document.id,
      );
    this.replaceDocumentDetails(document);
  }

  deleteResearchDocument(id: string): boolean {
    const row = this.db.prepare('SELECT date_id FROM research_document WHERE id = ?').get(id) as
      | { date_id: string | null }
      | undefined;
    const result = this.db.prepare('DELETE FROM research_document WHERE id = ?').run(id);
    if (row?.date_id !== null && row?.date_id !== undefined) {
      this.dates.delete(row.date_id);
    }
    return result.changes > 0;
  }

  getResearchDocument(id: string): ResearchDocumentRecord | undefined {
    const row = this.db
      .prepare('SELECT id, title, text, author, date_id FROM research_document WHERE id = ?')
      .get(id) as DocumentRow | undefined;
    return row ? this.hydrateDocument(row) : undefined;
  }

  listResearchDocuments(): ResearchDocumentRecord[] {
    const rows = this.db
      .prepare('SELECT id, title, text, author, date_id FROM research_document ORDER BY id')
      .all() as unknown as DocumentRow[];
    return rows.map((row) => this.hydrateDocument(row));
  }

  private replaceDocumentDetails(document: ResearchDocumentRecord): void {
    this.db.prepare('DELETE FROM research_document_subject WHERE research_document_id = ?').run(document.id);
    this.db.prepare('DELETE FROM research_conclusion WHERE research_document_id = ?').run(document.id);
    const insertSubject = this.db.prepare(
      'INSERT INTO research_document_subject (id, research_document_id, person_id) VALUES (?, ?, ?)',
    );
    for (const personId of document.subjectIds ?? []) {
      insertSubject.run(crypto.randomUUID(), document.id, personId);
    }
    const insertConclusion = this.db.prepare(
      'INSERT INTO research_conclusion (id, research_document_id, person_id, text) VALUES (?, ?, ?, ?)',
    );
    for (const conclusion of document.conclusions ?? []) {
      insertConclusion.run(conclusion.id, document.id, conclusion.personId, conclusion.text);
    }
  }

  private hydrateDocument(row: DocumentRow): ResearchDocumentRecord {
    const datesById = this.dates.getMany([row.date_id].filter((id): id is string => id !== null));
    const subjects = this.db
      .prepare('SELECT person_id FROM research_document_subject WHERE research_document_id = ? ORDER BY id')
      .all(row.id) as unknown as { person_id: string }[];
    const conclusions = this.db
      .prepare('SELECT id, person_id, text FROM research_conclusion WHERE research_document_id = ? ORDER BY id')
      .all(row.id) as unknown as { id: string; person_id: string; text: string }[];
    const document: ResearchDocumentRecord = {
      id: row.id,
      title: row.title ?? undefined,
      text: row.text,
      author: row.author ?? undefined,
      date: row.date_id !== null ? datesById.get(row.date_id) : undefined,
    };
    if (subjects.length > 0) {
      document.subjectIds = subjects.map((subject) => subject.person_id);
    }
    if (conclusions.length > 0) {
      document.conclusions = conclusions.map((conclusion) => ({
        id: conclusion.id,
        personId: conclusion.person_id,
        text: conclusion.text,
      }));
    }
    return document;
  }

  insertResearchActivity(activity: ResearchActivityRecord): void {
    this.db
      .prepare(
        `INSERT INTO research_activity (id, type, purpose, target, venue, result, date_id, researcher)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        activity.id,
        activity.type ?? null,
        activity.purpose ?? null,
        activity.target ?? null,
        activity.venue ?? null,
        activity.result ?? null,
        activity.date ? this.dates.upsert(activity.date) : null,
        activity.researcher ?? null,
      );
  }

  updateResearchActivity(activity: ResearchActivityRecord): void {
    this.db
      .prepare(
        `UPDATE research_activity SET type = ?, purpose = ?, target = ?, venue = ?, result = ?, date_id = ?, researcher = ?
         WHERE id = ?`,
      )
      .run(
        activity.type ?? null,
        activity.purpose ?? null,
        activity.target ?? null,
        activity.venue ?? null,
        activity.result ?? null,
        activity.date ? this.dates.upsert(activity.date) : null,
        activity.researcher ?? null,
        activity.id,
      );
  }

  deleteResearchActivity(id: string): boolean {
    const row = this.db.prepare('SELECT date_id FROM research_activity WHERE id = ?').get(id) as
      | { date_id: string | null }
      | undefined;
    const result = this.db.prepare('DELETE FROM research_activity WHERE id = ?').run(id);
    if (row?.date_id !== null && row?.date_id !== undefined) {
      this.dates.delete(row.date_id);
    }
    return result.changes > 0;
  }

  listResearchActivities(): ResearchActivityRecord[] {
    const rows = this.db
      .prepare('SELECT id, type, purpose, target, venue, result, date_id, researcher FROM research_activity ORDER BY id')
      .all() as unknown as ActivityRow[];
    const datesById = this.dates.getMany(
      rows.map((row) => row.date_id).filter((id): id is string => id !== null),
    );
    return rows.map((row) => ({
      id: row.id,
      type: row.type ?? undefined,
      purpose: row.purpose ?? undefined,
      target: row.target ?? undefined,
      venue: row.venue ?? undefined,
      result: row.result ?? undefined,
      date: row.date_id !== null ? datesById.get(row.date_id) : undefined,
      researcher: row.researcher ?? undefined,
    }));
  }

  // censuses ----------------------------------------------------------------------

  insertCensus(census: CensusRecord): void {
    this.db
      .prepare('INSERT INTO census (id, schedule, date_id, place_id) VALUES (?, ?, ?, ?)')
      .run(
        census.id,
        census.schedule ?? null,
        census.date ? this.dates.upsert(census.date) : null,
        census.placeId ?? null,
      );
    this.replaceCensusEntries(census);
  }

  updateCensus(census: CensusRecord): void {
    this.db
      .prepare('UPDATE census SET schedule = ?, date_id = ?, place_id = ? WHERE id = ?')
      .run(
        census.schedule ?? null,
        census.date ? this.dates.upsert(census.date) : null,
        census.placeId ?? null,
        census.id,
      );
    this.replaceCensusEntries(census);
  }

  deleteCensus(id: string): boolean {
    const dateIds = new Set<string>();
    const censusRow = this.db.prepare('SELECT date_id FROM census WHERE id = ?').get(id) as
      | { date_id: string | null }
      | undefined;
    if (censusRow?.date_id !== null && censusRow?.date_id !== undefined) {
      dateIds.add(censusRow.date_id);
    }
    const entries = this.db
      .prepare('SELECT birth_date_id FROM census_entry WHERE census_id = ? AND birth_date_id IS NOT NULL')
      .all(id) as unknown as { birth_date_id: string }[];
    for (const entry of entries) {
      dateIds.add(entry.birth_date_id);
    }
    const result = this.db.prepare('DELETE FROM census WHERE id = ?').run(id);
    for (const dateId of dateIds) {
      this.dates.delete(dateId);
    }
    return result.changes > 0;
  }

  getCensus(id: string): CensusRecord | undefined {
    const row = this.db.prepare('SELECT id, schedule, date_id, place_id FROM census WHERE id = ?').get(id) as
      | CensusRow
      | undefined;
    return row ? this.hydrateCensus(row) : undefined;
  }

  listCensuses(): CensusRecord[] {
    const rows = this.db
      .prepare('SELECT id, schedule, date_id, place_id FROM census ORDER BY id')
      .all() as unknown as CensusRow[];
    return rows.map((row) => this.hydrateCensus(row));
  }

  private replaceCensusEntries(census: CensusRecord): void {
    const existing = this.db
      .prepare('SELECT birth_date_id FROM census_entry WHERE census_id = ? AND birth_date_id IS NOT NULL')
      .all(census.id) as unknown as { birth_date_id: string }[];
    this.db.prepare('DELETE FROM census_entry WHERE census_id = ?').run(census.id);
    const insert = this.db.prepare(
      `INSERT INTO census_entry (id, census_id, person_id, father_id, mother_id, sex, age_value,
         marital_status, occupation, birth_date_id, birth_place_text)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const entry of census.entries) {
      insert.run(
        entry.id,
        census.id,
        entry.personId,
        entry.fatherId ?? null,
        entry.motherId ?? null,
        entry.sex ?? null,
        entry.ageValue ?? null,
        entry.maritalStatus ?? null,
        entry.occupation ?? null,
        entry.birthDate ? this.dates.upsert(entry.birthDate) : null,
        entry.birthPlace ?? null,
      );
    }
    const kept = new Set(census.entries.map((entry) => entry.birthDate?.id).filter((id): id is string => id !== undefined));
    for (const stale of existing) {
      if (!kept.has(stale.birth_date_id)) {
        this.dates.delete(stale.birth_date_id);
      }
    }
  }

  private hydrateCensus(row: CensusRow): CensusRecord {
    const dateIds = new Set<string>();
    if (row.date_id !== null) {
      dateIds.add(row.date_id);
    }
    const entries = this.db
      .prepare(
        `SELECT id, census_id, person_id, father_id, mother_id, sex, age_value, marital_status,
           occupation, birth_date_id, birth_place_text
         FROM census_entry WHERE census_id = ? ORDER BY id`,
      )
      .all(row.id) as unknown as EntryRow[];
    for (const entry of entries) {
      if (entry.birth_date_id !== null) {
        dateIds.add(entry.birth_date_id);
      }
    }
    const datesById = this.dates.getMany([...dateIds]);
    return {
      id: row.id,
      schedule: row.schedule ?? undefined,
      date: row.date_id !== null ? datesById.get(row.date_id) : undefined,
      placeId: row.place_id ?? undefined,
      entries: entries.map((entry) => {
        const birthDate = entry.birth_date_id !== null ? datesById.get(entry.birth_date_id) : undefined;
        return {
          id: entry.id,
          personId: entry.person_id,
          fatherId: entry.father_id ?? undefined,
          motherId: entry.mother_id ?? undefined,
          sex: entry.sex ?? undefined,
          ageValue: entry.age_value ?? undefined,
          maritalStatus: entry.marital_status ?? undefined,
          occupation: entry.occupation ?? undefined,
          ...(birthDate !== undefined ? { birthDate } : {}),
          birthPlace: entry.birth_place_text ?? undefined,
        };
      }),
    };
  }

  // duplicate candidates -------------------------------------------------------------

  insertDuplicate(duplicate: DuplicateCandidateRecord): void {
    this.db
      .prepare(
        'INSERT INTO duplicate_candidate (id, person_id, other_person_id, caption, assessment, status) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(
        duplicate.id,
        duplicate.personId,
        duplicate.otherPersonId,
        duplicate.caption ?? null,
        duplicate.assessment ?? null,
        duplicate.status ?? null,
      );
  }

  updateDuplicate(duplicate: DuplicateCandidateRecord): void {
    this.db
      .prepare(
        'UPDATE duplicate_candidate SET person_id = ?, other_person_id = ?, caption = ?, assessment = ?, status = ? WHERE id = ?',
      )
      .run(
        duplicate.personId,
        duplicate.otherPersonId,
        duplicate.caption ?? null,
        duplicate.assessment ?? null,
        duplicate.status ?? null,
        duplicate.id,
      );
  }

  deleteDuplicate(id: string): boolean {
    return this.db.prepare('DELETE FROM duplicate_candidate WHERE id = ?').run(id).changes > 0;
  }

  listDuplicates(): DuplicateCandidateRecord[] {
    const rows = this.db
      .prepare('SELECT id, person_id, other_person_id, caption, assessment, status FROM duplicate_candidate ORDER BY id')
      .all() as unknown as {
      id: string;
      person_id: string;
      other_person_id: string;
      caption: string | null;
      assessment: string | null;
      status: string | null;
    }[];
    return rows.map((row) => ({
      id: row.id,
      personId: row.person_id,
      otherPersonId: row.other_person_id,
      caption: row.caption ?? undefined,
      assessment: row.assessment ?? undefined,
      status: row.status ?? undefined,
    }));
  }

  // titles ---------------------------------------------------------------------------

  insertTitle(title: TitleRecord): void {
    this.db
      .prepare(
        `INSERT INTO title (id, xref, name, author, publisher, series, abbreviation, repository_id, call_number, sequence)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(...titleParams(title));
  }

  updateTitle(title: TitleRecord): void {
    this.db
      .prepare(
        `UPDATE title SET xref = ?, name = ?, author = ?, publisher = ?, series = ?, abbreviation = ?,
           repository_id = ?, call_number = ?, sequence = ? WHERE id = ?`,
      )
      .run(...titleParams(title).slice(1), title.id);
  }

  deleteTitle(id: string): boolean {
    return this.db.prepare('DELETE FROM title WHERE id = ?').run(id).changes > 0;
  }

  listTitles(): TitleRecord[] {
    const rows = this.db
      .prepare(
        'SELECT id, xref, name, author, publisher, series, abbreviation, repository_id, call_number, sequence FROM title ORDER BY id',
      )
      .all() as unknown as TitleRow[];
    return rows.map(rowToTitle);
  }
}

interface TodoRow {
  id: string;
  text: string;
  target_type: string | null;
  target_id: string | null;
  category: string | null;
  locality: string | null;
  priority: string | null;
  status: string | null;
  created_date_id: string | null;
  scheduled_date_id: string | null;
  reminder_date_id: string | null;
  closed_date_id: string | null;
  repository_id: string | null;
}

interface EvidenceRow {
  id: string;
  type: string | null;
  document_type: string | null;
  analysis: string | null;
}

interface FindingRow {
  id: string;
  evidence_id: string;
  type: string | null;
  value: string | null;
  date_id: string | null;
  place_id: string | null;
  age_bound: string | null;
  age_years: number | null;
  age_months: number | null;
  age_days: number | null;
  age_phrase: string | null;
}

interface LinkRow {
  id: string;
  evidence_id: string;
  target_type: string;
  target_id: string;
  confidence: string | null;
  used: string | null;
  quality: string | null;
}

interface DocumentRow {
  id: string;
  title: string | null;
  text: string;
  author: string | null;
  date_id: string | null;
}

interface ActivityRow {
  id: string;
  type: string | null;
  purpose: string | null;
  target: string | null;
  venue: string | null;
  result: string | null;
  date_id: string | null;
  researcher: string | null;
}

interface CensusRow {
  id: string;
  schedule: string | null;
  date_id: string | null;
  place_id: string | null;
}

interface EntryRow {
  id: string;
  census_id: string;
  person_id: string;
  father_id: string | null;
  mother_id: string | null;
  sex: string | null;
  age_value: string | null;
  marital_status: string | null;
  occupation: string | null;
  birth_date_id: string | null;
  birth_place_text: string | null;
}

interface TitleRow {
  id: string;
  xref: string | null;
  name: string | null;
  author: string | null;
  publisher: string | null;
  series: string | null;
  abbreviation: string | null;
  repository_id: string | null;
  call_number: string | null;
  sequence: number | null;
}

const todoSelect = `SELECT id, text, target_type, target_id, category, locality, priority, status,
  created_date_id, scheduled_date_id, reminder_date_id, closed_date_id, repository_id
  FROM todo`;

function todoParams(todo: TodoRecord, dates: DateRepo): Array<string | number | null> {
  return [
    todo.id,
    todo.text,
    todo.targetType ?? null,
    todo.targetId ?? null,
    todo.category ?? null,
    todo.locality ?? null,
    todo.priority ?? null,
    todo.status ?? null,
    todo.createdDate ? dates.upsert(todo.createdDate) : null,
    todo.scheduledDate ? dates.upsert(todo.scheduledDate) : null,
    todo.reminderDate ? dates.upsert(todo.reminderDate) : null,
    todo.closedDate ? dates.upsert(todo.closedDate) : null,
    todo.repositoryId ?? null,
  ];
}

function rowToLink(row: LinkRow): EvidenceLinkRecord {
  return {
    id: row.id,
    evidenceId: row.evidence_id,
    targetType: row.target_type,
    targetId: row.target_id,
    confidence: row.confidence ?? undefined,
    used: row.used ?? undefined,
    quality: row.quality ?? undefined,
  };
}

function titleParams(title: TitleRecord): Array<string | number | null> {
  return [
    title.id,
    title.xref ?? null,
    title.name ?? null,
    title.author ?? null,
    title.publisher ?? null,
    title.series ?? null,
    title.abbreviation ?? null,
    title.repositoryId ?? null,
    title.callNumber ?? null,
    title.sequence ?? null,
  ];
}

function rowToTitle(row: TitleRow): TitleRecord {
  return {
    id: row.id,
    xref: row.xref ?? undefined,
    name: row.name ?? undefined,
    author: row.author ?? undefined,
    publisher: row.publisher ?? undefined,
    series: row.series ?? undefined,
    abbreviation: row.abbreviation ?? undefined,
    repositoryId: row.repository_id ?? undefined,
    callNumber: row.call_number ?? undefined,
    sequence: row.sequence ?? undefined,
  };
}

export type { ResearchConclusion };
