import { describe, expect, it } from 'vitest';
import type {
  AddressRecord,
  ContactRecord,
  FactTypeRecord,
  IdentifierRecord,
  MediaLinkRecord,
  NoteRecord,
  RepositoryRecord,
  RestrictionRecord,
  SourceRecord,
  SubmitterRecord,
  TagLinkRecord,
  TagRecord,
} from '../src/model/types';
import { OpQueue } from '../src/ops/op';
import { TreeService } from '../src/service/tree';
import { cleanupRepo, makeRepo } from './helpers';

function makeService() {
  const fixture = makeRepo();
  const service = new TreeService(fixture.repo, new OpQueue());
  return { fixture, service };
}

const note = (overrides: Partial<NoteRecord> = {}): NoteRecord => ({
  id: 'N1',
  text: 'Look for the marriage record',
  targetType: 'person',
  targetId: 'P1',
  ...overrides,
});

const source = (overrides: Partial<SourceRecord> = {}): SourceRecord => ({
  id: 'S1',
  title: 'Parish register',
  ...overrides,
});

const mediaLink = (overrides: Partial<MediaLinkRecord> = {}): MediaLinkRecord => ({
  id: 'ML1',
  mediaId: 'M1',
  targetType: 'person',
  targetId: 'P1',
  ...overrides,
});

const identifier = (overrides: Partial<IdentifierRecord> = {}): IdentifierRecord => ({
  id: 'I1',
  targetType: 'person',
  targetId: 'P1',
  namespace: 'familysearch',
  value: 'abc-123',
  ...overrides,
});

const contact = (overrides: Partial<ContactRecord> = {}): ContactRecord => ({
  id: 'CT1',
  targetType: 'person',
  targetId: 'P1',
  kind: 'email',
  value: 'ivan@example.org',
  ...overrides,
});

const restriction = (overrides: Partial<RestrictionRecord> = {}): RestrictionRecord => ({
  id: 'R1',
  targetType: 'person',
  targetId: 'P1',
  level: 'confidential',
  ...overrides,
});

const tag = (overrides: Partial<TagRecord> = {}): TagRecord => ({
  id: 'TG1',
  name: 'favorites',
  ...overrides,
});

const tagLink = (overrides: Partial<TagLinkRecord> = {}): TagLinkRecord => ({
  id: 'TL1',
  tagId: 'TG1',
  targetType: 'person',
  targetId: 'P1',
  ...overrides,
});

const repository = (overrides: Partial<RepositoryRecord> = {}): RepositoryRecord => ({
  id: 'RP1',
  name: 'State Archive',
  ...overrides,
});

const submitter = (overrides: Partial<SubmitterRecord> = {}): SubmitterRecord => ({
  id: 'SU1',
  name: 'Ivan Petrov',
  ...overrides,
});

const address = (overrides: Partial<AddressRecord> = {}): AddressRecord => ({
  id: 'AD1',
  lines: ['12 Archive Lane'],
  city: 'Moscow',
  ...overrides,
});

const factType = (overrides: Partial<FactTypeRecord> = {}): FactTypeRecord => ({
  id: 'FT1',
  code: 'MILT',
  title: 'military service',
  ...overrides,
});

describe('TreeService attachments', () => {
  it('adds, splits, updates and deletes notes with undo', () => {
    const { fixture, service } = makeService();
    try {
      service.addNote(note());
      expect(fixture.repo.listNotes().map((entry) => entry.id)).toEqual(['N1']);
      expect(fixture.repo.listNotesFor('person', 'P1').map((entry) => entry.id)).toEqual(['N1']);

      const after = note({ text: 'Edited text' });
      service.updateNote(note(), after);
      expect(fixture.repo.getNote('N1')?.text).toBe('Edited text');

      service.deleteNote(after);
      expect(fixture.repo.getNote('N1')).toBeUndefined();
      service.undo();
      expect(fixture.repo.getNote('N1')?.text).toBe('Edited text');
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('splits a shared note edited from one of its contexts', () => {
    const { fixture, service } = makeService();
    try {
      const shared: NoteRecord = {
        id: 'N1',
        text: 'shared',
        links: [
          { id: 'L1', targetType: 'person', targetId: 'P1' },
          { id: 'L2', targetType: 'person', targetId: 'P2' },
        ],
      };
      fixture.repo.insertNote(shared);

      const after: NoteRecord = { id: 'N1', text: 'edited for P1', links: shared.links };
      service.updateNote(shared, after, { id: 'L1', targetType: 'person', targetId: 'P1' });

      const notes = fixture.repo.listNotes();
      expect(notes.map((entry) => entry.text).sort()).toEqual(['edited for P1', 'shared']);
      const copy = notes.find((entry) => entry.text === 'edited for P1')!;
      expect(copy.id).not.toBe('N1');

      service.undo();
      expect(fixture.repo.listNotes().map((entry) => entry.text)).toEqual(['shared']);
      expect(fixture.repo.listNotesFor('person', 'P1').map((entry) => entry.id)).toEqual(['N1']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('adds sources with and without a citation, updates and deletes them', () => {
    const { fixture, service } = makeService();
    try {
      service.addSource(source(), 'person', 'P1');
      expect(fixture.repo.listSources().map((entry) => entry.id)).toEqual(['S1']);
      expect(fixture.repo.listCitationsFor('person', 'P1').map((entry) => entry.source.id)).toEqual(['S1']);
      expect(fixture.repo.listAllCitations().map((entry) => entry.id)).toHaveLength(1);

      service.addSource(source({ id: 'S2' }));
      expect(fixture.repo.listSources()).toHaveLength(2);
      expect(fixture.repo.listAllCitations()).toHaveLength(1);

      const after = source({ author: 'Ivan Petrov' });
      service.updateSource(source(), after);
      expect(fixture.repo.getSource('S1')?.author).toBe('Ivan Petrov');

      service.deleteSource(after);
      expect(fixture.repo.getSource('S1')).toBeUndefined();
      expect(fixture.repo.listAllCitations()).toHaveLength(0);
      service.undo();
      expect(fixture.repo.getSource('S1')?.author).toBe('Ivan Petrov');
      // Undoing the delete restores the source and its citations — one
      // undo step, no losses.
      expect(fixture.repo.listAllCitations().map((entry) => entry.sourceId)).toEqual(['S1']);
      expect(fixture.repo.listCitationsFor('person', 'P1').map((entry) => entry.source.id)).toEqual(['S1']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('attaches, updates and detaches citations with undo', () => {
    const { fixture, service } = makeService();
    try {
      fixture.repo.insertSource(source());
      service.attachSource('S1', 'person', 'P1');
      expect(fixture.repo.listCitationsFor('person', 'P1').map((entry) => entry.source.id)).toEqual(['S1']);
      expect(fixture.repo.listCitationRecordsFor('person', 'P1').map((entry) => entry.id)).toHaveLength(1);

      const [created] = fixture.repo.listCitationRecordsFor('person', 'P1')!;
      const after = { ...created!, targetId: 'P2' };
      service.updateCitation(created!, after);
      expect(fixture.repo.listCitationRecordsFor('person', 'P2')).toEqual([after]);

      service.detachCitation(created!.id);
      expect(fixture.repo.listCitationRecordsFor('person', 'P2')).toEqual([]);
      service.undo();
      expect(fixture.repo.listCitationRecordsFor('person', 'P2')).toEqual([after]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('attaches and detaches media links with undo', () => {
    const { fixture, service } = makeService();
    try {
      service.addMedia({ id: 'M1', path: 'media/photo.jpg', title: 'Portrait', targetType: 'person', targetId: 'P1' });
      expect(fixture.repo.listMediaFor('person', 'P1')).toHaveLength(1);

      service.attachMedia(mediaLink({ mediaId: 'M1' }));
      expect(fixture.repo.listMediaFor('person', 'P1')).toHaveLength(2);

      service.detachMedia(mediaLink({ mediaId: 'M1' }));
      expect(fixture.repo.listMediaFor('person', 'P1')).toHaveLength(1);
      service.undo();
      expect(fixture.repo.listMediaFor('person', 'P1')).toHaveLength(2);

      service.deleteMedia({ id: 'M1', path: 'media/photo.jpg', title: 'Portrait', targetType: 'person', targetId: 'P1' });
      expect(fixture.repo.listMediaFor('person', 'P1')).toEqual([]);
      service.undo();
      // The media row comes back with its own target link; the extra link
      // was cascaded and is not in the attachment snapshot.
      expect(fixture.repo.listMediaFor('person', 'P1')).toHaveLength(1);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('manages identifiers, contacts and restrictions', () => {
    const { fixture, service } = makeService();
    try {
      service.addIdentifier(identifier());
      expect(fixture.repo.listIdentifiersFor('person', 'P1')).toEqual([identifier()]);
      service.deleteIdentifier(identifier());
      expect(fixture.repo.listIdentifiersFor('person', 'P1')).toEqual([]);
      service.undo();
      expect(fixture.repo.listIdentifiersFor('person', 'P1')).toEqual([identifier()]);

      service.addContact(contact());
      expect(fixture.repo.listContactsFor('person', 'P1')).toEqual([contact()]);
      service.deleteContact(contact());
      expect(fixture.repo.listContactsFor('person', 'P1')).toEqual([]);
      service.undo();
      expect(fixture.repo.listContactsFor('person', 'P1')).toEqual([contact()]);

      service.addRestriction(restriction());
      expect(fixture.repo.listRestrictionsFor('person', 'P1')).toEqual([restriction()]);
      service.deleteRestriction(restriction());
      expect(fixture.repo.listRestrictionsFor('person', 'P1')).toEqual([]);
      service.undo();
      expect(fixture.repo.listRestrictionsFor('person', 'P1')).toEqual([restriction()]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('manages tags and tag links', () => {
    const { fixture, service } = makeService();
    try {
      service.addTag(tag());
      expect(fixture.repo.listTags()).toEqual([tag()]);

      service.attachTag(tagLink());
      expect(fixture.repo.listTagLinksFor('person', 'P1')).toEqual([{ tagId: 'TG1', link: tagLink() }]);

      service.detachTag(tagLink());
      expect(fixture.repo.listTagLinksFor('person', 'P1')).toEqual([]);
      service.undo();
      expect(fixture.repo.listTagLinksFor('person', 'P1')).toHaveLength(1);

      const renamed = tag({ name: 'Verified' });
      service.updateTag(tag(), renamed);
      expect(fixture.repo.listTags()).toEqual([renamed]);
      service.undo();
      expect(fixture.repo.listTags()).toEqual([tag()]);

      service.deleteTag(tag());
      expect(fixture.repo.listTags()).toEqual([]);
      // The FK cascade removes the links; the undo restores them too.
      expect(fixture.repo.listTagLinksFor('person', 'P1')).toEqual([]);
      service.undo();
      expect(fixture.repo.listTags()).toEqual([tag()]);
      expect(fixture.repo.listTagLinksFor('person', 'P1')).toHaveLength(1);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('manages repositories, submitters, addresses and fact types', () => {
    const { fixture, service } = makeService();
    try {
      service.addRepository(repository());
      expect(fixture.repo.listRepositories()).toEqual([repository()]);
      const afterRepo = repository({ name: 'City Archive' });
      service.updateRepository(repository(), afterRepo);
      expect(fixture.repo.getRepository('RP1')?.name).toBe('City Archive');
      service.deleteRepository(afterRepo);
      expect(fixture.repo.listRepositories()).toEqual([]);
      service.undo();
      expect(fixture.repo.listRepositories()).toEqual([afterRepo]);

      service.addSubmitter(submitter());
      expect(fixture.repo.listSubmitters()).toEqual([submitter()]);
      const afterSubmitter = submitter({ name: 'Maria Ivanova' });
      service.updateSubmitter(submitter(), afterSubmitter);
      expect(fixture.repo.getSubmitter('SU1')?.name).toBe('Maria Ivanova');
      service.deleteSubmitter(afterSubmitter);
      expect(fixture.repo.listSubmitters()).toEqual([]);
      service.undo();
      expect(fixture.repo.listSubmitters()).toEqual([afterSubmitter]);

      service.addAddress(address());
      expect(fixture.repo.getAddress('AD1')).toEqual(address());
      const afterAddress = address({ city: 'Berlin' });
      service.updateAddress(address(), afterAddress);
      expect(fixture.repo.getAddress('AD1')?.city).toBe('Berlin');
      service.deleteAddress(afterAddress);
      expect(fixture.repo.getAddress('AD1')).toBeUndefined();
      service.undo();
      expect(fixture.repo.getAddress('AD1')?.city).toBe('Berlin');

      service.addFactType(factType());
      expect(fixture.repo.listFactTypes()).toEqual([factType()]);
      const afterType = factType({ title: 'army' });
      service.updateFactType(factType(), afterType);
      expect(fixture.repo.listFactTypes()).toEqual([afterType]);
      service.deleteFactType(afterType);
      expect(fixture.repo.listFactTypes()).toEqual([]);
      service.undo();
      expect(fixture.repo.listFactTypes()).toEqual([afterType]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('changes are recorded for the touched entity and cleaned with the entity', () => {
    const { fixture, service } = makeService();
    try {
      service.addNote(note());
      const changes = fixture.repo.listChangesFor('note', 'N1');
      expect(changes).toHaveLength(1);
      expect(changes[0]?.kind).toBe('created');

      service.deleteNote(note());
      expect(fixture.repo.listChangesFor('note', 'N1')).toEqual([]);

      service.undo();
      expect(fixture.repo.listChangesFor('note', 'N1')).toHaveLength(1);
    } finally {
      cleanupRepo(fixture);
    }
  });
});
