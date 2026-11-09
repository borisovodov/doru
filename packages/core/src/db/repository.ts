import type { DatabaseSync } from 'node:sqlite';
import type {
  CitationRecord,
  FactRecord,
  FamilyRecord,
  MediaRecord,
  NoteRecord,
  PersonRecord,
  PlaceRecord,
  SourceRecord,
  TreeDocument,
} from '../model/types';
import { DateRepo } from './dateRepo';
import { FactRepo } from './factRepo';
import { FamilyRepo } from './familyRepo';
import { MediaRepo } from './mediaRepo';
import { NameRepo } from './nameRepo';
import { NoteRepo } from './noteRepo';
import { PersonRepo, type PersonQuery, type PersonRow } from './personRepo';
import { PlaceRepo } from './placeRepo';
import { SourceRepo } from './sourceRepo';
import { TransactionScope } from './transaction';

export type { PersonQuery } from './personRepo';

export interface TreeRepository {
  insertPerson(person: PersonRecord): void;
  updatePerson(person: PersonRecord): void;
  getPerson(id: string): PersonRecord | undefined;
  deletePerson(id: string): boolean;
  listPersons(query?: PersonQuery): PersonRecord[];
  listAllPersons(): PersonRecord[];
  countPersons(): number;
  countFamilies(): number;
  insertFamily(family: FamilyRecord): void;
  updateFamily(family: FamilyRecord): void;
  getFamily(id: string): FamilyRecord | undefined;
  deleteFamily(id: string): boolean;
  listFamilies(): FamilyRecord[];
  /** Every family the person belongs to, as a partner or a child. */
  listFamiliesForPerson(personId: string): FamilyRecord[];
  insertFact(fact: FactRecord): void;
  updateFact(fact: FactRecord): void;
  deleteFact(id: string): boolean;
  listFactsForPerson(personId: string): FactRecord[];
  listFactsForFamily(familyId: string): FactRecord[];
  /** Every fact in the tree, ordered by date. */
  listAllFacts(): FactRecord[];
  /** Facts that happened at the given place. */
  listFactsForPlace(placeId: string): FactRecord[];
  insertPlace(place: PlaceRecord): void;
  updatePlace(place: PlaceRecord): void;
  getPlace(id: string): PlaceRecord | undefined;
  deletePlace(id: string): boolean;
  listPlaces(): PlaceRecord[];
  searchPlaces(query: string, limit?: number): PlaceRecord[];
  insertSource(source: SourceRecord): void;
  deleteSource(id: string): boolean;
  listSources(): SourceRecord[];
  addSourceCitation(sourceId: string, targetType: string, targetId: string): void;
  insertCitation(citation: CitationRecord): void;
  deleteCitation(id: string): boolean;
  getCitation(id: string): CitationRecord | undefined;
  listCitationsFor(targetType: string, targetId: string): Array<{ id: string; source: SourceRecord }>;
  /** Full citation rows for a target, including page and quality. */
  listCitationRecordsFor(targetType: string, targetId: string): CitationRecord[];
  /** Every citation in the tree. */
  listAllCitations(): CitationRecord[];
  insertNote(note: NoteRecord): void;
  deleteNote(id: string): boolean;
  listNotes(): NoteRecord[];
  listNotesFor(targetType: string, targetId: string): NoteRecord[];
  insertMedia(media: MediaRecord): void;
  deleteMedia(id: string): boolean;
  listMediaFor(targetType: string, targetId: string): MediaRecord[];
  listAllMedia(): MediaRecord[];
  toTreeDocument(): TreeDocument;
  transaction<T>(fn: () => T): T;
}

/**
 * Facade over the per-entity repositories. Ops and services talk to this
 * interface; the entity split underneath is an implementation detail. The
 * facade also composes the person aggregate: the person row plus names
 * (NameRepo) and facts (FactRepo).
 */
export class SqliteTreeRepository implements TreeRepository {
  private readonly transactions: TransactionScope;
  private readonly persons: PersonRepo;
  private readonly names: NameRepo;
  private readonly families: FamilyRepo;
  private readonly facts: FactRepo;
  private readonly places: PlaceRepo;
  private readonly sources: SourceRepo;
  private readonly notes: NoteRepo;
  private readonly media: MediaRepo;

  constructor(db: DatabaseSync) {
    this.transactions = new TransactionScope(db);
    const dates = new DateRepo(db);
    this.persons = new PersonRepo(db, this.transactions);
    this.names = new NameRepo(db, dates);
    this.families = new FamilyRepo(db, this.transactions, dates);
    this.facts = new FactRepo(db, dates);
    this.places = new PlaceRepo(db, dates);
    this.sources = new SourceRepo(db);
    this.notes = new NoteRepo(db);
    this.media = new MediaRepo(db);
  }

  insertPerson(person: PersonRecord): void {
    this.transactions.run(() => {
      this.persons.insertPerson({ id: person.id, xref: person.xref, sex: person.sex });
      this.names.replaceNamesForPerson(person.id, person.names);
      for (const fact of person.facts) {
        this.facts.insertFact(fact);
      }
    });
  }

  /**
   * Replaces the person aggregate: identity fields and names are rewritten
   * in full, facts are synchronized by id (inserted when new, updated when
   * present, deleted when missing from the incoming list). Callers pass the
   * complete facts list; the before/after snapshot semantics make a save
   * from a stale view drop facts it did not know about — the renderer
   * reloads on external changes to keep that window small.
   */
  updatePerson(person: PersonRecord): void {
    this.transactions.run(() => {
      this.persons.updatePerson({ id: person.id, xref: person.xref, sex: person.sex });
      this.names.replaceNamesForPerson(person.id, person.names);
      const existing = this.facts.listFactsForPerson(person.id);
      const incoming = new Map(person.facts.map((fact) => [fact.id, fact]));
      for (const fact of person.facts) {
        if (existing.some((entry) => entry.id === fact.id)) {
          this.facts.updateFact(fact);
        } else {
          this.facts.insertFact(fact);
        }
      }
      for (const old of existing) {
        if (!incoming.has(old.id)) {
          this.facts.deleteFact(old.id);
        }
      }
    });
  }

  getPerson(id: string): PersonRecord | undefined {
    const base = this.persons.getPerson(id);
    if (!base) {
      return undefined;
    }
    return {
      ...base,
      names: this.names.listNamesForPerson(id),
      facts: this.facts.listFactsForPerson(id),
    };
  }

  /**
   * Deletes the person together with their name index rows, facts (and
   * their dates) and family links. Attachment rows (notes, citations, …)
   * are not touched until the attachment phase lands.
   */
  deletePerson(id: string): boolean {
    return this.transactions.run(() => {
      this.names.deleteFtsForPerson(id);
      this.facts.deleteFactsForPerson(id);
      this.families.removePersonFromFamilies(id);
      return this.persons.deletePerson(id);
    });
  }

  listPersons(query?: PersonQuery): PersonRecord[] {
    const bases = this.persons.listPersons(query);
    return this.withAggregates(bases);
  }

  listAllPersons(): PersonRecord[] {
    return this.withAggregates(this.persons.listAllPersons());
  }

  /** Attaches each person's names and facts, loaded in batched queries. */
  private withAggregates(bases: PersonRow[]): PersonRecord[] {
    const ids = bases.map((base) => base.id);
    const namesByPerson = this.names.listNamesForMany(ids);
    const factsByPerson = this.facts.listFactsForPersons(ids);
    return bases.map((base) => ({
      ...base,
      names: namesByPerson.get(base.id) ?? [],
      facts: factsByPerson.get(base.id) ?? [],
    }));
  }

  countPersons(): number {
    return this.persons.countPersons();
  }

  countFamilies(): number {
    return this.families.countFamilies();
  }

  insertFamily(family: FamilyRecord): void {
    this.families.insertFamily(family);
  }

  updateFamily(family: FamilyRecord): void {
    this.families.updateFamily(family);
  }

  getFamily(id: string): FamilyRecord | undefined {
    return this.families.getFamily(id);
  }

  deleteFamily(id: string): boolean {
    return this.transactions.run(() => {
      this.facts.deleteFactsForFamily(id);
      return this.families.deleteFamily(id);
    });
  }

  listFamilies(): FamilyRecord[] {
    return this.families.listFamilies();
  }

  listFamiliesForPerson(personId: string): FamilyRecord[] {
    return this.families.listFamiliesForPerson(personId);
  }

  insertFact(fact: FactRecord): void {
    this.facts.insertFact(fact);
  }

  updateFact(fact: FactRecord): void {
    this.facts.updateFact(fact);
  }

  deleteFact(id: string): boolean {
    return this.facts.deleteFact(id);
  }

  listFactsForPerson(personId: string): FactRecord[] {
    return this.facts.listFactsForPerson(personId);
  }

  listFactsForFamily(familyId: string): FactRecord[] {
    return this.facts.listFactsForFamily(familyId);
  }

  listAllFacts(): FactRecord[] {
    return this.facts.listAllFacts();
  }

  listFactsForPlace(placeId: string): FactRecord[] {
    return this.facts.listFactsForPlace(placeId);
  }

  insertPlace(place: PlaceRecord): void {
    this.places.insertPlace(place);
  }

  updatePlace(place: PlaceRecord): void {
    this.places.updatePlace(place);
  }

  getPlace(id: string): PlaceRecord | undefined {
    return this.places.getPlace(id);
  }

  deletePlace(id: string): boolean {
    return this.places.deletePlace(id);
  }

  listPlaces(): PlaceRecord[] {
    return this.places.listPlaces();
  }

  searchPlaces(query: string, limit?: number): PlaceRecord[] {
    return this.places.searchPlaces(query, limit);
  }

  insertSource(source: SourceRecord): void {
    this.sources.insertSource(source);
  }

  deleteSource(id: string): boolean {
    return this.sources.deleteSource(id);
  }

  listSources(): SourceRecord[] {
    return this.sources.listSources();
  }

  addSourceCitation(sourceId: string, targetType: string, targetId: string): void {
    this.sources.addSourceCitation(sourceId, targetType, targetId);
  }

  insertCitation(citation: CitationRecord): void {
    this.sources.insertCitation(citation);
  }

  deleteCitation(id: string): boolean {
    return this.sources.deleteCitation(id);
  }

  getCitation(id: string): CitationRecord | undefined {
    return this.sources.getCitation(id);
  }

  listCitationsFor(targetType: string, targetId: string): Array<{ id: string; source: SourceRecord }> {
    return this.sources.listCitationsFor(targetType, targetId);
  }

  listCitationRecordsFor(targetType: string, targetId: string): CitationRecord[] {
    return this.sources.listCitations(targetType, targetId);
  }

  listAllCitations(): CitationRecord[] {
    return this.sources.listAllCitations();
  }

  insertNote(note: NoteRecord): void {
    this.notes.insertNote(note);
  }

  deleteNote(id: string): boolean {
    return this.notes.deleteNote(id);
  }

  listNotes(): NoteRecord[] {
    return this.notes.listNotes();
  }

  listNotesFor(targetType: string, targetId: string): NoteRecord[] {
    return this.notes.listNotesFor(targetType, targetId);
  }

  insertMedia(media: MediaRecord): void {
    this.media.insertMedia(media);
  }

  deleteMedia(id: string): boolean {
    return this.media.deleteMedia(id);
  }

  listMediaFor(targetType: string, targetId: string): MediaRecord[] {
    return this.media.listMediaFor(targetType, targetId);
  }

  listAllMedia(): MediaRecord[] {
    return this.media.listAllMedia();
  }

  toTreeDocument(): TreeDocument {
    return {
      persons: new Map(this.listAllPersons().map((person) => [person.id, person])),
      families: new Map(this.listFamilies().map((family) => [family.id, family])),
    };
  }

  transaction<T>(fn: () => T): T {
    return this.transactions.run(fn);
  }
}
