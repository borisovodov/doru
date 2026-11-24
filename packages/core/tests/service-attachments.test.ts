import { describe, expect, it, vi } from 'vitest';
import type {
  AddressRecord,
  ContactRecord,
  IdentifierRecord,
  MediaLinkRecord,
  NoteRecord,
  RepositoryRecord,
  SourceRecord,
  SubmitterRecord,
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
  lines: [{ id: 'AL1', value: '12 Archive Lane' }],
  city: 'Moscow',
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

  it('stamps note creation, edits and split copies, but not link changes', () => {
    const { fixture, service } = makeService();
    try {
      vi.useFakeTimers();
      vi.setSystemTime(1_700_000_000_000);
      service.addNote(note());
      expect(fixture.repo.getNote('N1')).toMatchObject({
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_000_000,
      });

      vi.setSystemTime(1_700_000_100_000);
      const stored = fixture.repo.getNote('N1')!;
      service.updateNote(stored, { ...stored, text: 'Edited note' });
      expect(fixture.repo.getNote('N1')).toMatchObject({
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_100_000,
      });

      vi.setSystemTime(1_700_000_200_000);
      service.attachNote('N1', { id: 'L2', targetType: 'family', targetId: 'F1' });
      expect(fixture.repo.getNote('N1')?.updatedAt).toBe(1_700_000_100_000);

      vi.setSystemTime(1_700_000_300_000);
      const shared = fixture.repo.getNote('N1')!;
      const personLink = shared.links!.find((link) => link.targetType === 'person')!;
      service.updateNote(shared, { ...shared, text: 'Split edit' }, personLink);

      const split = fixture.repo.listNotes().find((entry) => entry.text === 'Split edit')!;
      expect(split).toMatchObject({
        createdAt: 1_700_000_300_000,
        updatedAt: 1_700_000_300_000,
      });
      expect(fixture.repo.getNote('N1')).toMatchObject({
        text: 'Edited note',
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_100_000,
      });
    } finally {
      vi.useRealTimers();
      cleanupRepo(fixture);
    }
  });

  it('ignores a stale context edit after its link is detached', () => {
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
      const stored = fixture.repo.getNote('N1')!;
      const p1 = stored.links!.find((link) => link.targetId === 'P1')!;
      service.detachNote(stored, p1);

      service.updateNote(stored, { ...stored, text: 'stale edit' }, p1);

      expect(fixture.repo.getNote('N1')?.text).toBe('shared');
      expect(fixture.repo.listNotes().map((note) => note.text)).toEqual(['shared']);
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

  it('attaches and detaches a shared note with undo', () => {
    const { fixture, service } = makeService();
    try {
      service.addNote(note());
      const link = { id: 'L2', targetType: 'family', targetId: 'F1' };
      service.attachNote('N1', link);
      const shared = fixture.repo.getNote('N1')!;
      expect(shared.links).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ targetType: 'family', targetId: 'F1' }),
          expect.objectContaining({ targetType: 'person', targetId: 'P1' }),
        ]),
      );

      service.detachNote(shared, link);
      expect(fixture.repo.listNotesFor('family', 'F1')).toEqual([]);
      expect(fixture.repo.getNote('N1')?.links?.map((entry) => entry.targetId)).toEqual(['P1']);

      const last = fixture.repo.getNote('N1')!;
      service.detachNote(last, last.links![0]!);
      expect(fixture.repo.getNote('N1')).toBeUndefined();
      service.undo();
      expect(fixture.repo.getNote('N1')?.links?.map((entry) => entry.targetId)).toEqual(['P1']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('keeps one note link when the same target is attached twice', () => {
    const { fixture, service } = makeService();
    try {
      service.addNote(note());
      service.attachNote('N1', { id: 'L2', targetType: 'family', targetId: 'F1' });
      service.attachNote('N1', { id: 'L3', targetType: 'person', targetId: 'P1' });
      service.attachNote('N1', { id: 'L4', targetType: 'person', targetId: 'P1' });

      expect(fixture.repo.getNote('N1')?.links).toHaveLength(2);
      expect(fixture.repo.listNotesFor('person', 'P1')).toHaveLength(1);

      // The duplicate attaches are not undo entries: one undo removes the family link.
      service.undo();
      expect(fixture.repo.listNotesFor('family', 'F1')).toEqual([]);
      expect(fixture.repo.listNotesFor('person', 'P1')).toHaveLength(1);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('restores attachments on facts and names when a person is deleted', () => {
    const { fixture, service } = makeService();
    try {
      const person = {
        id: 'P1',
        sex: 'U' as const,
        names: [{ id: 'N1', given: 'Ivan' }],
        facts: [{ id: 'F1', personId: 'P1', tag: 'BIRT' }],
      };
      service.addPerson(person);
      fixture.repo.insertSource({ id: 'S1', title: 'Parish register' });
      fixture.repo.insertNote({
        id: 'NN1',
        text: 'name note',
        targetType: 'name',
        targetId: 'N1',
      });
      fixture.repo.addSourceCitation('S1', 'fact', 'F1');

      const stored = fixture.repo.getPerson('P1')!;
      service.deletePerson(stored);
      expect(fixture.repo.getNote('NN1')).toBeUndefined();
      expect(fixture.repo.listCitationRecordsFor('fact', 'F1')).toEqual([]);

      service.undo();
      expect(fixture.repo.getNote('NN1')?.text).toBe('name note');
      expect(fixture.repo.listCitationRecordsFor('fact', 'F1')).toHaveLength(1);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('refuses to cite a task', () => {
    const { fixture, service } = makeService();
    try {
      service.addPerson({ id: 'P1', names: [], sex: 'U', facts: [] });
      service.addTask({ id: 'T1', text: 'Find the record', targets: [] });

      expect(() => service.addSource(source(), 'task', 'T1')).toThrow('A source cannot be attached to a task.');
      expect(fixture.repo.listCitationsFor('task', 'T1')).toEqual([]);

      service.addSource(source());
      expect(() => service.attachSource('S1', 'task', 'T1')).toThrow('A source cannot be attached to a task.');
      expect(fixture.repo.listCitationsFor('task', 'T1')).toEqual([]);

      service.attachSource('S1', 'person', 'P1');
      const [citation] = fixture.repo.listCitationRecordsFor('person', 'P1');
      expect(() => service.updateCitation(citation!, { ...citation!, targetType: 'task', targetId: 'T1' })).toThrow(
        'A source cannot be attached to a task.',
      );
      expect(fixture.repo.listCitationRecordsFor('person', 'P1')).toEqual([citation]);
      expect(fixture.repo.listCitationsFor('task', 'T1')).toEqual([]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('allows citations on a note but refuses every other target link', () => {
    const { fixture, service } = makeService();
    try {
      service.addNote(note());
      service.addSource(source());
      service.attachSource('S1', 'note', 'N1');
      expect(fixture.repo.listCitationRecordsFor('note', 'N1')).toHaveLength(1);

      service.addTask({ id: 'T1', text: 'Find the record', targets: [] });
      expect(() => service.addTaskLink({ id: 'TL1', taskId: 'T1', targetType: 'note', targetId: 'N1' })).toThrow(
        'Only source citations may target a note.',
      );
      expect(() =>
        service.addTask({
          id: 'T2',
          text: 'Another task',
          targets: [{ id: 'TL2', taskId: 'T2', targetType: 'note', targetId: 'N1' }],
        }),
      ).toThrow('Only source citations may target a note.');

      expect(() => service.attachNote('N1', { id: 'L2', targetType: 'note', targetId: 'N2' })).toThrow(
        'Only source citations may target a note.',
      );
      expect(() => service.addNote(note({ id: 'N2', targetType: 'note', targetId: 'N1' }))).toThrow(
        'Only source citations may target a note.',
      );

      service.addMedia({ id: 'M1', links: [] });
      expect(() => service.attachMedia({ id: 'ML1', mediaId: 'M1', targetType: 'note', targetId: 'N1' })).toThrow(
        'Only source citations may target a note.',
      );
      expect(() => service.attachMediaToTargets('M1', [{ targetType: 'note', targetId: 'N1' }])).toThrow(
        'Only source citations may target a note.',
      );

      expect(() => service.addIdentifier(identifier({ targetType: 'note', targetId: 'N1' }))).toThrow(
        'Only source citations may target a note.',
      );
      expect(() => service.addRecordSubmitter('SU1', 'note', 'N1')).toThrow('Only source citations may target a note.');

      // The failed attempts left no rows behind.
      expect(fixture.repo.listTaskLinksFor('note', 'N1')).toEqual([]);
      expect(fixture.repo.listMediaLinksFor('note', 'N1')).toEqual([]);
      expect(fixture.repo.listIdentifiersFor('note', 'N1')).toEqual([]);
      expect(fixture.repo.listRecordSubmittersFor('note', 'N1')).toEqual([]);
      expect(fixture.repo.listNotesFor('note', 'N1')).toEqual([]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('adds sources with and without a citation, updates and deletes them', () => {
    const { fixture, service } = makeService();
    try {
      service.addPerson({ id: 'P1', names: [], sex: 'U', facts: [] });
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
      service.addPerson({ id: 'P1', names: [], sex: 'U', facts: [] });
      service.addPerson({ id: 'P2', names: [], sex: 'U', facts: [] });
      fixture.repo.insertSource(source());
      service.attachSource('S1', 'person', 'P1');
      expect(fixture.repo.listCitationsFor('person', 'P1').map((entry) => entry.source.id)).toEqual(['S1']);
      expect(fixture.repo.listCitationRecordsFor('person', 'P1').map((entry) => entry.id)).toHaveLength(1);

      const [created] = fixture.repo.listCitationRecordsFor('person', 'P1');
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

  it('does not duplicate an existing source citation or media link', () => {
    const { fixture, service } = makeService();
    try {
      service.addPerson({ id: 'P1', names: [], sex: 'U', facts: [] });
      fixture.repo.insertSource(source());
      service.attachSource('S1', 'person', 'P1');
      service.attachSource('S1', 'person', 'P1');
      expect(fixture.repo.listCitationRecordsFor('person', 'P1')).toHaveLength(1);

      service.addMedia({ id: 'M1', path: 'media/photo.jpg', title: 'Portrait', targetType: 'person', targetId: 'P1' });
      service.attachMedia(mediaLink({ mediaId: 'M1' }));
      expect(fixture.repo.getMedia('M1')?.links).toHaveLength(1);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('attaches and detaches media links with undo', () => {
    const { fixture, service } = makeService();
    try {
      service.addPerson({ id: 'P1', names: [], sex: 'U', facts: [] });
      service.addMedia({ id: 'M1', path: 'media/photo.jpg', title: 'Portrait', targetType: 'person', targetId: 'P1' });
      service.addMedia({ id: 'M2', path: 'media/second.jpg', title: 'Second' });
      expect(fixture.repo.listMediaFor('person', 'P1')).toHaveLength(1);

      service.attachMedia(mediaLink({ mediaId: 'M2' }));
      expect(fixture.repo.listMediaFor('person', 'P1')).toHaveLength(2);

      service.detachMedia(mediaLink({ mediaId: 'M2' }));
      expect(fixture.repo.listMediaFor('person', 'P1')).toHaveLength(1);
      service.undo();
      expect(fixture.repo.listMediaFor('person', 'P1')).toHaveLength(2);

      service.deleteMedia({
        id: 'M1',
        path: 'media/photo.jpg',
        title: 'Portrait',
        targetType: 'person',
        targetId: 'P1',
      });
      expect(fixture.repo.listMediaFor('person', 'P1').map((entry) => entry.id)).toEqual(['M2']);
      service.undo();
      // The service snapshots the full current record, so both links are
      // restored by one undo.
      expect(fixture.repo.listMediaFor('person', 'P1')).toHaveLength(2);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('restores media-link citations when detaching and deleting the record', () => {
    const { fixture, service } = makeService();
    try {
      service.addPerson({ id: 'P1', names: [], sex: 'U', facts: [] });
      service.addSource(source());
      service.addMedia({ id: 'M1', path: 'media/photo.jpg', title: 'Portrait', targetType: 'person', targetId: 'P1' });
      const link = fixture.repo.listAttachmentsFor('person', 'P1').mediaLinks[0]!.link;
      fixture.repo.insertCitation({
        id: 'C1',
        sourceId: 'S1',
        targetType: 'media_link',
        targetId: link.id,
        page: 'p. 1',
      });
      expect(fixture.repo.listCitationRecordsFor('media_link', link.id)).toHaveLength(1);

      service.detachMedia(link);
      expect(fixture.repo.listMediaFor('person', 'P1')).toEqual([]);
      expect(fixture.repo.listCitationRecordsFor('media_link', link.id)).toEqual([]);
      service.undo();
      expect(
        fixture.repo.listAttachmentsFor('person', 'P1').mediaLinks.some((entry) => entry.link.id === link.id),
      ).toBe(true);
      expect(fixture.repo.listCitationRecordsFor('media_link', link.id).map((entry) => entry.id)).toEqual(['C1']);

      const media = fixture.repo.getMedia('M1')!;
      service.deleteMedia(media);
      expect(fixture.repo.getMedia('M1')).toBeUndefined();
      expect(fixture.repo.listCitationRecordsFor('media_link', link.id)).toEqual([]);
      service.undo();
      expect(fixture.repo.getMedia('M1')).toBeDefined();
      expect(
        fixture.repo.listAttachmentsFor('person', 'P1').mediaLinks.some((entry) => entry.link.id === link.id),
      ).toBe(true);
      expect(fixture.repo.listCitationRecordsFor('media_link', link.id).map((entry) => entry.id)).toEqual(['C1']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('updates media records and link metadata with undo', () => {
    const { fixture, service } = makeService();
    try {
      service.addMedia({ id: 'M1', path: 'media/photo.jpg', title: 'Portrait', targetType: 'person', targetId: 'P1' });
      const before = fixture.repo.getMedia('M1')!;
      const after = { ...before, title: 'Wedding portrait' };
      service.updateMedia(before, after);
      expect(fixture.repo.getMedia('M1')?.title).toBe('Wedding portrait');
      service.undo();
      expect(fixture.repo.getMedia('M1')?.title).toBe('Portrait');

      const beforeLink = fixture.repo.listAttachmentsFor('person', 'P1').mediaLinks[0]!.link;
      const afterLink = { ...beforeLink, title: 'Front', sequence: 2, primary: true };
      service.updateMediaLink(beforeLink, afterLink);
      expect(
        fixture.repo.listAttachmentsFor('person', 'P1').mediaLinks.find((entry) => entry.link.id === beforeLink.id)
          ?.link,
      ).toMatchObject({ title: 'Front', sequence: 2, primary: true });
      service.undo();
      expect(
        fixture.repo.listAttachmentsFor('person', 'P1').mediaLinks.find((entry) => entry.link.id === beforeLink.id)
          ?.link,
      ).toMatchObject({ title: undefined, sequence: undefined });
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('restores attachments of a removed media file on undo', () => {
    const { fixture, service } = makeService();
    try {
      service.addMedia({
        id: 'M1',
        files: [
          { id: 'F1', path: 'media/a.jpg' },
          { id: 'F2', path: 'media/b.jpg' },
        ],
      });
      service.addNote(note({ id: 'N2', targetType: 'media_file', targetId: 'F1' }));
      const before = fixture.repo.getMedia('M1')!;
      service.updateMedia(before, { ...before, files: [{ id: 'F2', path: 'media/b.jpg' }] });
      expect(fixture.repo.listNotesFor('media_file', 'F1')).toEqual([]);

      service.undo();
      expect(fixture.repo.listNotesFor('media_file', 'F1').map((entry) => entry.id)).toEqual(['N2']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('restores media and its attachments when the last link is detached', () => {
    const { fixture, service } = makeService();
    try {
      service.addMedia({ id: 'M1', path: 'media/photo.jpg', title: 'Portrait', targetType: 'person', targetId: 'P1' });
      service.addNote(note({ targetType: 'media', targetId: 'M1' }));
      expect(fixture.repo.getMedia('M1')).toBeDefined();

      const link = fixture.repo.listAttachmentsFor('person', 'P1').mediaLinks[0]!.link;
      service.detachMedia(link);
      expect(fixture.repo.getMedia('M1')).toBeUndefined();
      expect(fixture.repo.listNotesFor('media', 'M1')).toEqual([]);

      service.undo();
      expect(fixture.repo.getMedia('M1')).toBeDefined();
      expect(fixture.repo.listNotesFor('media', 'M1').map((entry) => entry.id)).toEqual(['N1']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('manages identifiers and contacts', () => {
    const { fixture, service } = makeService();
    try {
      service.addIdentifier(identifier());
      expect(fixture.repo.listIdentifiersFor('person', 'P1')).toEqual([identifier()]);
      const editedIdentifier = identifier({ value: 'xyz-999' });
      service.updateIdentifier(identifier(), editedIdentifier);
      expect(fixture.repo.listIdentifiersFor('person', 'P1')).toEqual([editedIdentifier]);
      service.undo();
      expect(fixture.repo.listIdentifiersFor('person', 'P1')).toEqual([identifier()]);
      service.deleteIdentifier(identifier());
      expect(fixture.repo.listIdentifiersFor('person', 'P1')).toEqual([]);
      service.undo();
      expect(fixture.repo.listIdentifiersFor('person', 'P1')).toEqual([identifier()]);

      service.addContact(contact());
      expect(fixture.repo.listContactsFor('person', 'P1')).toEqual([contact()]);
      const editedContact = contact({ kind: 'phone', value: '+7 495 000-00-00' });
      service.updateContact(contact(), editedContact);
      expect(fixture.repo.listContactsFor('person', 'P1')).toEqual([editedContact]);
      service.undo();
      expect(fixture.repo.listContactsFor('person', 'P1')).toEqual([contact()]);
      service.deleteContact(contact());
      expect(fixture.repo.listContactsFor('person', 'P1')).toEqual([]);
      service.undo();
      expect(fixture.repo.listContactsFor('person', 'P1')).toEqual([contact()]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('refuses contacts on targets without a GEDCOM contact slot', () => {
    const { fixture, service } = makeService();
    try {
      service.addTask({ id: 'T1', text: 'Find the record', targets: [] });
      expect(() => service.addContact(contact({ targetType: 'task', targetId: 'T1' }))).toThrow(
        'A contact cannot be attached to a task.',
      );
      expect(fixture.repo.listContactsFor('task', 'T1')).toEqual([]);

      const familyContact = contact({ id: 'C2', targetType: 'family', targetId: 'F1' });
      fixture.repo.insertContact(familyContact);
      expect(() => service.updateContact(familyContact, { ...familyContact, value: '+7 495 000-00-00' })).toThrow(
        'A contact cannot be attached to a family.',
      );
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('links one source or media record to several targets in one undo step', () => {
    const { fixture, service } = makeService();
    try {
      service.addPerson({ id: 'P1', names: [], sex: 'U', facts: [] });
      service.addPerson({ id: 'P2', names: [], sex: 'U', facts: [] });
      service.addSource(source());
      service.addMedia({ id: 'M1', path: 'media/photo.jpg' });

      service.attachSourceToTargets('S1', [
        { targetType: 'person', targetId: 'P1' },
        { targetType: 'person', targetId: 'P2' },
      ]);
      expect(fixture.repo.listCitationsFor('person', 'P1')).toHaveLength(1);
      expect(fixture.repo.listCitationsFor('person', 'P2')).toHaveLength(1);

      service.attachMediaToTargets('M1', [
        { targetType: 'person', targetId: 'P1' },
        { targetType: 'person', targetId: 'P2' },
      ]);
      expect(fixture.repo.listMediaFor('person', 'P1')).toHaveLength(1);
      expect(fixture.repo.listMediaFor('person', 'P2')).toHaveLength(1);
      expect(fixture.repo.getMedia('M1')?.links).toHaveLength(2);
      const [firstLink] = fixture.repo.listMediaLinksFor('person', 'P1');
      fixture.repo.insertCitation({
        id: 'C1',
        sourceId: 'S1',
        targetType: 'media_link',
        targetId: firstLink!.link.id,
      });

      service.undo();
      expect(fixture.repo.getMedia('M1')?.links).toEqual([]);
      expect(fixture.repo.listCitationRecordsFor('media_link', firstLink!.link.id)).toEqual([]);
      service.undo();
      expect(fixture.repo.listCitationsFor('person', 'P1')).toEqual([]);
      expect(fixture.repo.listCitationsFor('person', 'P2')).toEqual([]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('restores associations, aliases and their attachments after a person delete', () => {
    const { fixture, service } = makeService();
    try {
      service.addPerson({ id: 'P1', names: [{ id: 'N1', given: 'Ivan' }], sex: 'M', facts: [] });
      service.addPerson({ id: 'P2', names: [{ id: 'N2', given: 'Maria' }], sex: 'F', facts: [] });
      service.addAssociation({ id: 'A1', personId: 'P1', otherPersonId: 'P2' });
      service.addNote(note({ id: 'N1', targetType: 'association', targetId: 'A1' }));
      service.addAlias('P1', 'P2');

      service.deletePerson(fixture.repo.getPerson('P1')!);
      expect(fixture.repo.listAssociationsFor('P1')).toEqual([]);
      expect(fixture.repo.listAliasesFor('P1')).toEqual([]);

      service.undo();
      expect(fixture.repo.listAssociationsFor('P1').map((entry) => entry.id)).toEqual(['A1']);
      expect(fixture.repo.listAliasesFor('P1')).toHaveLength(1);
      expect(fixture.repo.listNotesFor('association', 'A1').map((entry) => entry.id)).toEqual(['N1']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('cleans and restores address attachments on delete', () => {
    const { fixture, service } = makeService();
    try {
      service.addAddress(address());
      service.addRepository({ id: 'RP1', name: 'Archive', addressId: 'AD1' });
      service.addNote(note({ targetType: 'address', targetId: 'AD1' }));
      service.deleteAddress(address());
      expect(fixture.repo.getAddress('AD1')).toBeUndefined();
      expect(fixture.repo.getRepository('RP1')?.addressId).toBeUndefined();
      expect(fixture.repo.listNotesFor('address', 'AD1')).toEqual([]);

      service.undo();
      expect(fixture.repo.getAddress('AD1')).toBeDefined();
      expect(fixture.repo.getRepository('RP1')?.addressId).toBe('AD1');
      expect(fixture.repo.listNotesFor('address', 'AD1').map((entry) => entry.id)).toEqual(['N1']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('restores address and title references without overwriting later edits', () => {
    const { fixture, service } = makeService();
    try {
      service.addPerson({ id: 'P1', names: [{ id: 'N1', given: 'Ada' }], sex: 'U', facts: [] });
      service.addAddress(address());
      const beforeAddress = fixture.repo.getPerson('P1')!;
      service.updatePerson(beforeAddress, { ...beforeAddress, addressId: 'AD1' });
      service.deleteAddress(fixture.repo.getAddress('AD1')!);

      fixture.repo.updatePerson({
        ...fixture.repo.getPerson('P1')!,
        names: [{ id: 'N2', given: 'Augusta' }],
      });
      service.undo();
      expect(fixture.repo.getPerson('P1')?.addressId).toBe('AD1');
      expect(fixture.repo.getPerson('P1')?.names[0]?.id).toBe('N2');

      service.addRepository(repository());
      service.addTitle({ id: 'TT1', name: 'Old title', repositoryId: 'RP1' });
      service.deleteRepository(fixture.repo.getRepository('RP1')!);

      fixture.repo.updateTitle({ ...fixture.repo.listTitles()[0]!, name: 'Edited title' });
      service.undo();

      expect(fixture.repo.listTitles()[0]).toMatchObject({ name: 'Edited title', repositoryId: 'RP1' });
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('restores a submitter link only once across media and consumer snapshots', () => {
    const { fixture, service } = makeService();
    try {
      service.addSubmitter(submitter());
      service.addMedia({ id: 'M1', title: 'Scan' });
      service.attachMedia({ id: 'ML1', mediaId: 'M1', targetType: 'submitter', targetId: 'SU1' });
      service.addRecordSubmitter('SU1', 'media_link', 'ML1');
      const link = fixture.repo.listRecordSubmittersFor('media_link', 'ML1')[0]!;

      service.deleteSubmitter(submitter());
      expect(fixture.repo.getSubmitter('SU1')).toBeUndefined();
      expect(fixture.repo.getMedia('M1')?.links).toEqual([]);
      expect(fixture.repo.listRecordSubmittersFor('media_link', 'ML1')).toEqual([]);

      service.undo();

      expect(fixture.repo.getSubmitter('SU1')).toBeDefined();
      expect(fixture.repo.getMedia('M1')?.links).toEqual([
        expect.objectContaining({ id: 'ML1', targetType: 'submitter', targetId: 'SU1' }),
      ]);
      expect(fixture.repo.listRecordSubmittersFor('media_link', 'ML1')).toEqual([link]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('manages repositories, submitters and addresses', () => {
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
      expect(fixture.repo.listAddresses()).toEqual([address()]);
      expect(service.listAddresses()).toEqual([address()]);
      const afterAddress = address({ city: 'Berlin' });
      service.updateAddress(address(), afterAddress);
      expect(fixture.repo.getAddress('AD1')?.city).toBe('Berlin');
      service.deleteAddress(afterAddress);
      expect(fixture.repo.getAddress('AD1')).toBeUndefined();
      service.undo();
      expect(fixture.repo.getAddress('AD1')?.city).toBe('Berlin');
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('restores repository, submitter and title consumers on undo', () => {
    const { fixture, service } = makeService();
    try {
      service.addRepository(repository());
      service.addSubmitter(submitter());
      service.addTitle({ id: 'TL1', name: 'The Parish Registers' });
      service.addSource(
        source({
          repositories: [
            {
              id: 'SR1',
              repositoryId: 'RP1',
              callNumbers: [{ id: 'CN1', value: 'F.12', medium: 'film' }],
            },
          ],
          titleId: 'TL1',
        }),
      );
      service.addRecordSubmitter('SU1', 'source', 'S1');

      service.deleteRepository(repository());
      expect(fixture.repo.getSource('S1')?.repositories).toBeUndefined();
      service.undo();
      expect(fixture.repo.getSource('S1')?.repositories).toEqual([
        expect.objectContaining({
          id: 'SR1',
          repositoryId: 'RP1',
          callNumbers: [expect.objectContaining({ id: 'CN1', value: 'F.12', medium: 'film' })],
        }),
      ]);

      service.deleteSubmitter(submitter());
      expect(fixture.repo.listRecordSubmittersFor('source', 'S1')).toEqual([]);
      service.undo();
      expect(fixture.repo.listRecordSubmittersFor('source', 'S1')).toEqual([
        expect.objectContaining({ submitterId: 'SU1', targetType: 'source', targetId: 'S1' }),
      ]);

      service.deleteTitle({ id: 'TL1', name: 'The Parish Registers' });
      expect(fixture.repo.getSource('S1')?.titleId).toBeUndefined();
      service.undo();
      expect(fixture.repo.getSource('S1')?.titleId).toBe('TL1');
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('stores submitter link kinds and restores them on undo', () => {
    const { fixture, service } = makeService();
    try {
      service.addPerson({ id: 'P1', names: [], sex: 'U', facts: [] });
      service.addSubmitter(submitter());
      service.addRecordSubmitter('SU1', 'person', 'P1', 'contributor');
      service.addRecordSubmitter('SU1', 'person', 'P1', 'ancestor_interest');
      service.addRecordSubmitter('SU1', 'person', 'P1', 'descendant_interest');
      expect(new Set(fixture.repo.listRecordSubmittersFor('person', 'P1').map((link) => link.kind))).toEqual(
        new Set(['ancestor_interest', 'contributor', 'descendant_interest']),
      );

      const link = fixture.repo
        .listRecordSubmittersFor('person', 'P1')
        .find((entry) => entry.kind === 'ancestor_interest')!;
      service.deleteRecordSubmitter(link.id, 'SU1', 'person', 'P1', 'ancestor_interest');
      expect(new Set(fixture.repo.listRecordSubmittersFor('person', 'P1').map((entry) => entry.kind))).toEqual(
        new Set(['contributor', 'descendant_interest']),
      );
      service.undo();
      expect(new Set(fixture.repo.listRecordSubmittersFor('person', 'P1').map((entry) => entry.kind))).toEqual(
        new Set(['ancestor_interest', 'contributor', 'descendant_interest']),
      );
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('links and unlinks record contributors with undo', () => {
    const { fixture, service } = makeService();
    try {
      service.addPerson({ id: 'P1', names: [], sex: 'U', facts: [] });
      service.addSubmitter(submitter());
      service.addRecordSubmitter('SU1', 'person', 'P1');
      expect(fixture.repo.listRecordSubmittersFor('person', 'P1').map((entry) => entry.submitterId)).toEqual(['SU1']);
      expect(fixture.repo.listSubmittersFor('person', 'P1')).toEqual(['SU1']);

      const [link] = fixture.repo.listRecordSubmittersFor('person', 'P1');
      service.deleteRecordSubmitter(link!.id, link!.submitterId, link!.targetType, link!.targetId);
      expect(fixture.repo.listRecordSubmittersFor('person', 'P1')).toEqual([]);

      service.undo();
      expect(fixture.repo.listSubmittersFor('person', 'P1')).toEqual(['SU1']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('restores citation attachments on detach undo', () => {
    const { fixture, service } = makeService();
    try {
      service.addSource(source());
      const person = fixture.repo.getPerson('P1');
      if (person === undefined) {
        service.addPerson({ id: 'P1', names: [], sex: 'U', facts: [] });
      }
      service.attachSource('S1', 'person', 'P1');
      const [citation] = fixture.repo.listCitationRecordsFor('person', 'P1');
      service.addNote({
        ...note(),
        links: [{ id: 'NL1', targetType: 'citation', targetId: citation!.id }],
      });
      expect(fixture.repo.listNotesFor('citation', citation!.id).map((entry) => entry.id)).toEqual(['N1']);

      service.detachCitation(citation!.id);
      expect(fixture.repo.listNotesFor('citation', citation!.id)).toEqual([]);
      service.undo();
      expect(fixture.repo.getCitation(citation!.id)).toBeDefined();
      expect(fixture.repo.listNotesFor('citation', citation!.id).map((entry) => entry.id)).toEqual(['N1']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('lists every submitter link for the global registry', () => {
    const { fixture, service } = makeService();
    try {
      service.addPerson({ id: 'P1', names: [], sex: 'U', facts: [] });
      service.addSubmitter(submitter());
      service.addRecordSubmitter('SU1', 'person', 'P1', 'ancestor_interest');
      expect(fixture.repo.listAllRecordSubmitters()).toEqual([
        expect.objectContaining({
          submitterId: 'SU1',
          targetType: 'person',
          targetId: 'P1',
          kind: 'ancestor_interest',
        }),
      ]);
    } finally {
      cleanupRepo(fixture);
    }
  });
});
