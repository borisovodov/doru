import type { DatabaseSync } from 'node:sqlite';
import type {
  EventRecord,
  FamilyRecord,
  MediaRecord,
  NoteRecord,
  PersonRecord,
  SourceRecord,
  TreeDocument,
} from '../model/types';
import { EventRepo } from './eventRepo';
import { FamilyRepo } from './familyRepo';
import { MediaRepo } from './mediaRepo';
import { NoteRepo } from './noteRepo';
import { PersonRepo, type PersonQuery } from './personRepo';
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
  insertSource(source: SourceRecord): void;
  deleteSource(id: string): boolean;
  listSources(): SourceRecord[];
  addSourceCitation(sourceId: string, targetType: string, targetId: string): void;
  insertCitation(citation: { id: string; sourceId: string; targetType: string; targetId: string }): void;
  deleteCitation(id: string): boolean;
  getCitation(id: string): { id: string; sourceId: string; targetType: string; targetId: string } | undefined;
  listCitationsFor(targetType: string, targetId: string): Array<{ id: string; source: SourceRecord }>;
  insertNote(note: NoteRecord): void;
  deleteNote(id: string): boolean;
  listNotes(): NoteRecord[];
  insertEvent(event: EventRecord): void;
  deleteEvent(id: string): boolean;
  listEventsForPerson(personId: string): EventRecord[];
  listEventsForFamily(familyId: string): EventRecord[];
  insertMedia(media: MediaRecord): void;
  deleteMedia(id: string): boolean;
  listMediaFor(targetType: string, targetId: string): MediaRecord[];
  toTreeDocument(): TreeDocument;
  transaction<T>(fn: () => T): T;
}

/**
 * Facade over the per-entity repositories. Ops and services talk to this
 * interface; the entity split underneath is an implementation detail.
 */
export class SqliteTreeRepository implements TreeRepository {
  private readonly transactions: TransactionScope;
  private readonly persons: PersonRepo;
  private readonly families: FamilyRepo;
  private readonly sources: SourceRepo;
  private readonly notes: NoteRepo;
  private readonly events: EventRepo;
  private readonly media: MediaRepo;

  constructor(db: DatabaseSync) {
    this.transactions = new TransactionScope(db);
    this.persons = new PersonRepo(db);
    this.families = new FamilyRepo(db, this.transactions);
    this.sources = new SourceRepo(db);
    this.notes = new NoteRepo(db);
    this.events = new EventRepo(db);
    this.media = new MediaRepo(db);
  }

  insertPerson(person: PersonRecord): void {
    this.persons.insertPerson(person);
  }

  updatePerson(person: PersonRecord): void {
    this.persons.updatePerson(person);
  }

  getPerson(id: string): PersonRecord | undefined {
    return this.persons.getPerson(id);
  }

  deletePerson(id: string): boolean {
    return this.persons.deletePerson(id);
  }

  listPersons(query?: PersonQuery): PersonRecord[] {
    return this.persons.listPersons(query);
  }

  listAllPersons(): PersonRecord[] {
    return this.persons.listAllPersons();
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
    return this.families.deleteFamily(id);
  }

  listFamilies(): FamilyRecord[] {
    return this.families.listFamilies();
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

  insertCitation(citation: { id: string; sourceId: string; targetType: string; targetId: string }): void {
    this.sources.insertCitation(citation);
  }

  deleteCitation(id: string): boolean {
    return this.sources.deleteCitation(id);
  }

  getCitation(id: string): { id: string; sourceId: string; targetType: string; targetId: string } | undefined {
    return this.sources.getCitation(id);
  }

  listCitationsFor(targetType: string, targetId: string): Array<{ id: string; source: SourceRecord }> {
    return this.sources.listCitationsFor(targetType, targetId);
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

  insertEvent(event: EventRecord): void {
    this.events.insertEvent(event);
  }

  deleteEvent(id: string): boolean {
    return this.events.deleteEvent(id);
  }

  listEventsForPerson(personId: string): EventRecord[] {
    return this.events.listEventsForPerson(personId);
  }

  listEventsForFamily(familyId: string): EventRecord[] {
    return this.events.listEventsForFamily(familyId);
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

  toTreeDocument(): TreeDocument {
    return {
      persons: new Map(this.listAllPersons().map((person) => [person.id, person])),
      families: new Map(this.listFamilies().map((family) => [family.id, family])),
      sources: new Map(this.listSources().map((source) => [source.id, source])),
    };
  }

  transaction<T>(fn: () => T): T {
    return this.transactions.run(fn);
  }
}
