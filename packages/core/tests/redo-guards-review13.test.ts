import { describe, expect, it } from 'vitest';
import type { FamilyRecord, PersonRecord } from '../src/model/types';
import { OpQueue } from '../src/ops/op';
import { TreeService } from '../src/service/tree';
import { cleanupRepo, makeRepo } from './helpers';

const person = (id: string): PersonRecord => ({ id, names: [], sex: 'U', facts: [] });
const family = (id: string, overrides: Partial<FamilyRecord> = {}): FamilyRecord => ({
  id,
  partners: [],
  children: [],
  ...overrides,
});

function makeService() {
  const fixture = makeRepo();
  return { fixture, service: new TreeService(fixture.repo, new OpQueue()) };
}

describe('redo guards for nested attachment targets', () => {
  it('blocks submitter redo when a new record link appeared', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1'));
      service.addPerson(person('P2'));
      service.addSubmitter({ id: 'SU1', name: 'Researcher' });
      service.addRecordSubmitter('SU1', 'person', 'P1');
      service.deleteSubmitter(repo.getSubmitter('SU1')!);
      service.undo();
      repo.insertRecordSubmitter('RS2', 'SU1', 'person', 'P2', 'ancestor_interest');
      expect(service.redo().redoBlocked).toBe(true);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('blocks address redo when a new consumer appeared', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1'));
      service.addPerson(person('P2'));
      service.addAddress({ id: 'A1', lines: [] });
      service.deleteAddress(repo.getAddress('A1')!);
      service.undo();
      repo.updatePerson({ ...repo.getPerson('P2')!, addressId: 'A1' });
      expect(service.redo().redoBlocked).toBe(true);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('blocks source redo when a citation changed', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1'));
      service.addSource({ id: 'S1', title: 'Book' });
      service.attachSource('S1', 'person', 'P1');
      service.deleteSource(repo.getSource('S1')!);
      service.undo();
      const citation = repo.listCitationRecordsFor('person', 'P1')[0]!;
      repo.updateCitation({ ...citation, page: '2' });
      expect(service.redo().redoBlocked).toBe(true);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('blocks repository redo when a title link was cleared', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addRepository({ id: 'R1', name: 'Archive' });
      service.addTitle({ id: 'TI1', name: 'Register', repositoryId: 'R1' });
      service.deleteRepository(repo.getRepository('R1')!);
      service.undo();
      repo.updateTitle({ ...repo.getTitle('TI1')!, repositoryId: undefined });
      expect(service.redo().redoBlocked).toBe(true);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('blocks family redo when an owned fact or association changed', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1'));
      service.addPerson(person('P2'));
      service.addFamily(family('F1', { partners: ['P1'] }));
      service.addFact({ id: 'FM1', familyId: 'F1', tag: 'MARR', value: 'Draft' });
      service.addAssociation({ id: 'A1', familyId: 'F1', otherPersonId: 'P2', role: 'witness' });
      service.deleteFamily(repo.getFamily('F1')!);
      service.undo();
      repo.updateFact({ ...repo.getFact('FM1')!, value: 'Reviewed' });
      expect(service.redo().redoBlocked).toBe(true);

      // A second cycle checks the association record.
      service.deleteFamily(repo.getFamily('F1')!);
      service.undo();
      const association = repo.listAssociationsForFamily('F1')[0]!;
      repo.updateAssociation({ ...association, role: 'godparent' });
      expect(service.redo().redoBlocked).toBe(true);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('blocks place redo when a hierarchy row type changed', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPlace({ id: 'PARENT', names: [{ id: 'PN1', kind: 'official', position: 0, value: 'Parent' }] });
      service.addPlace({
        id: 'CHILD',
        names: [{ id: 'PN2', kind: 'official', position: 0, value: 'Child' }],
        hierarchy: [{ id: 'H1', parentId: 'PARENT', type: 'poli' }],
      });
      service.deletePlace(repo.getPlace('PARENT')!);
      service.undo();
      const child = repo.getPlace('CHILD')!;
      repo.updatePlace({ ...child, hierarchy: child.hierarchy?.map((link) => ({ ...link, type: 'geog' })) });
      expect(service.redo().redoBlocked).toBe(true);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('blocks person redo when an association changed', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1'));
      service.addPerson(person('P2'));
      service.addAssociation({ id: 'A1', personId: 'P1', otherPersonId: 'P2', role: 'witness' });
      service.deletePerson(repo.getPerson('P1')!);
      service.undo();
      const association = repo.listAssociationsFor('P1')[0]!;
      repo.updateAssociation({ ...association, role: 'godparent' });
      expect(service.redo().redoBlocked).toBe(true);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('blocks update redo when the edited row or an endpoint is gone', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addNote({ id: 'N1', text: 'A', targetType: 'person', targetId: 'P1' });
      service.updateNote(repo.getNote('N1')!, { ...repo.getNote('N1')!, text: 'B' });
      service.undo();
      repo.updateNote({ ...repo.getNote('N1')!, text: 'C' });
      expect(service.redo().redoBlocked).toBe(true);

      service.addSource({ id: 'S1', title: 'A' });
      service.updateSource(repo.getSource('S1')!, { ...repo.getSource('S1')!, title: 'B' });
      service.undo();
      repo.deleteSource('S1');
      expect(service.redo().redoBlocked).toBe(true);

      service.addTitle({ id: 'TI1', name: 'A' });
      service.updateTitle(repo.getTitle('TI1')!, { ...repo.getTitle('TI1')!, name: 'B' });
      service.undo();
      repo.deleteTitle('TI1');
      expect(service.redo().redoBlocked).toBe(true);

      service.addPerson(person('P1'));
      service.addPerson(person('P2'));
      service.addPerson(person('P3'));
      service.addAssociation({ id: 'A1', personId: 'P1', otherPersonId: 'P2', role: 'witness' });
      service.updateAssociation(repo.listAssociationsFor('P1')[0]!, {
        ...repo.listAssociationsFor('P1')[0]!,
        otherPersonId: 'P3',
      });
      service.undo();
      repo.deletePerson('P3');
      expect(service.redo().redoBlocked).toBe(true);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('blocks place-update redo when a removed name gained evidence', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPlace({
        id: 'PL1',
        names: [
          { id: 'PN1', kind: 'official', position: 0, value: 'One' },
          { id: 'PN2', kind: 'official', position: 1, value: 'Two' },
        ],
      });
      const before = repo.getPlace('PL1')!;
      service.updatePlace(before, { ...before, names: [before.names[0]!] });
      service.undo();
      repo.insertNote({ id: 'N1', text: 'new', targetType: 'place_name', targetId: 'PN2' });
      expect(service.redo().redoBlocked).toBe(true);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('blocks media detach redo when a non-last link was edited', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1'));
      service.addPerson(person('P2'));
      service.addMedia({ id: 'M1', path: 'media/a.jpg', title: 'Photo', targetType: 'person', targetId: 'P1' });
      const first = repo.listAttachmentsFor('person', 'P1').mediaLinks[0]!;
      repo.addMediaLink('M1', { id: 'L2', mediaId: 'M1', targetType: 'person', targetId: 'P2' });
      service.detachMedia(first.link);
      service.undo();
      repo.updateMediaLink({
        ...repo.getMedia('M1')!.links!.find((link) => link.id === first.link.id)!,
        primary: true,
      });
      expect(service.redo().redoBlocked).toBe(true);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('blocks media detach redo when the last link gained media evidence', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1'));
      service.addMedia({ id: 'M1', path: 'media/a.jpg', title: 'Photo', targetType: 'person', targetId: 'P1' });
      const link = repo.listAttachmentsFor('person', 'P1').mediaLinks[0]!.link;
      service.detachMedia(link);
      service.undo();
      repo.insertNote({ id: 'N1', text: 'new', targetType: 'media', targetId: 'M1' });
      expect(service.redo().redoBlocked).toBe(true);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('allows repository redo after a title was reassigned before undo', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addRepository({ id: 'R1', name: 'Archive' });
      service.addRepository({ id: 'R2', name: 'Library' });
      service.addTitle({ id: 'TI1', name: 'Register', repositoryId: 'R1' });
      service.deleteRepository(repo.getRepository('R1')!);
      repo.updateTitle({ ...repo.getTitle('TI1')!, repositoryId: 'R2' });
      service.undo();
      expect(repo.getTitle('TI1')?.repositoryId).toBe('R2');
      expect(service.redo().redoBlocked).toBeUndefined();
      expect(repo.getRepository('R1')).toBeUndefined();
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('allows person redo when a dependency vanished before undo', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1'));
      service.addPerson(person('P2'));
      service.addAssociation({ id: 'A1', personId: 'P1', otherPersonId: 'P2', role: 'witness' });
      service.addFact({
        id: 'F1',
        personId: 'P2',
        tag: 'EVEN',
        participants: [{ id: 'FP1', personId: 'P1', position: 0 }],
      });
      service.deletePerson(repo.getPerson('P1')!);
      repo.deletePerson('P2');
      service.undo();
      expect(repo.getPerson('P1')).toBeDefined();
      expect(service.redo().redoBlocked).toBeUndefined();
      expect(repo.getPerson('P1')).toBeUndefined();
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('allows family redo when a cited source vanished before undo', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1'));
      service.addFamily(family('F1', { partners: ['P1'] }));
      service.addSource({ id: 'S1', title: 'Book' });
      service.addFact({ id: 'FACT1', familyId: 'F1', tag: 'MARR' });
      service.attachSource('S1', 'fact', 'FACT1');
      service.deleteFamily(repo.getFamily('F1')!);
      repo.deleteSource('S1');
      service.undo();
      expect(repo.getFamily('F1')).toBeDefined();
      expect(service.redo().redoBlocked).toBeUndefined();
      expect(repo.getFamily('F1')).toBeUndefined();
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('blocks alias redo when the same pair already exists under another id', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1'));
      service.addPerson(person('P2'));
      service.addAlias('P1', 'P2');
      service.undo();
      repo.insertAlias('AL2', 'P1', 'P2');
      expect(service.redo().redoBlocked).toBe(true);
      expect(repo.listAliasRowsFor('P1').filter((row) => row.aliasId === 'P2')).toHaveLength(1);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('blocks family redo when the live graph would gain a cycle', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1'));
      service.addPerson(person('P2'));
      service.addFamily(family('F1', { partners: ['P1'], children: ['P2'] }));
      service.undo();
      repo.insertFamily(family('F2', { partners: ['P2'], children: ['P1'] }));
      expect(service.redo().redoBlocked).toBe(true);
      expect(repo.getFamily('F1')).toBeUndefined();
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('handles a fact deleted before its edit is redone', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1'));
      service.addFact({ id: 'F1', personId: 'P1', tag: 'EVEN' });
      service.updateFact(repo.getFact('F1')!, { ...repo.getFact('F1')!, value: 'edited' });
      service.undo();
      repo.deleteFact('F1');
      const state = service.redo();
      expect(state.redoBlocked).toBe(true);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('allows place redo after a fact moved to another place before undo', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1'));
      service.addPlace({ id: 'PL1', names: [{ id: 'PN1', kind: 'official', position: 0, value: 'A' }] });
      service.addPlace({ id: 'PL2', names: [{ id: 'PN2', kind: 'official', position: 0, value: 'B' }] });
      service.addFact({ id: 'F1', personId: 'P1', tag: 'BIRT', placeId: 'PL1' });
      service.deletePlace(repo.getPlace('PL1')!);
      repo.updateFact({ ...repo.getFact('F1')!, placeId: 'PL2' });
      service.undo();
      expect(repo.getFact('F1')?.placeId).toBe('PL2');
      expect(service.redo().redoBlocked).toBeUndefined();
      expect(repo.getPlace('PL1')).toBeUndefined();
      expect(repo.getFact('F1')?.placeId).toBe('PL2');
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('blocks family redo when the adoption marker moved before undo', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('A'));
      service.addPerson(person('B'));
      service.addPerson(person('C'));
      service.addFamily(family('F1', { partners: ['A', 'B'], children: ['C'] }));
      service.addFact({
        id: 'ADOP1',
        personId: 'C',
        tag: 'ADOP',
        familyLinks: [{ id: 'FF1', familyId: 'F1', adoptedBy: 'HUSB', position: 0 }],
      });
      const before = repo.getFamily('F1')!;
      service.updateFamily(before, { ...before, partners: ['B', 'A'] });
      // Another writer points the marker at B (now HUSB) before the undo.
      repo.updateFact({
        ...repo.getFact('ADOP1')!,
        familyLinks: [{ id: 'FF1', familyId: 'F1', adoptedBy: 'HUSB', position: 0 }],
      });
      service.undo();
      expect(repo.getFamily('F1')?.partners).toEqual(['A', 'B']);
      expect(repo.getFact('ADOP1')?.familyLinks?.[0]?.adoptedBy).toBe('WIFE');
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('allows submitter redo when a linked person vanished before undo', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1'));
      service.addSubmitter({ id: 'SU1', name: 'Researcher' });
      service.addRecordSubmitter('SU1', 'person', 'P1');
      service.deleteSubmitter(repo.getSubmitter('SU1')!);
      repo.deletePerson('P1');
      service.undo();
      expect(repo.getSubmitter('SU1')?.id).toBe('SU1');
      expect(repo.listRecordSubmittersForSubmitter('SU1')).toEqual([]);
      expect(service.redo().redoBlocked).toBeUndefined();
      expect(repo.getSubmitter('SU1')).toBeUndefined();
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('allows source redo when a cited source vanished before undo', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addSource({ id: 'S1', title: 'Book' });
      service.addSource({ id: 'S2', title: 'Other' });
      service.attachSource('S1', 'source', 'S2');
      service.deleteSource(repo.getSource('S1')!);
      repo.deleteSource('S2');
      service.undo();
      expect(repo.getSource('S1')).toBeDefined();
      expect(repo.listAllCitations()).toEqual([]);
      expect(service.redo().redoBlocked).toBeUndefined();
      expect(repo.getSource('S1')).toBeUndefined();
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('allows address redo after a consumer moved to another address before undo', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addAddress({ id: 'A1', lines: [] });
      service.addAddress({ id: 'A2', lines: [] });
      service.addRepository({ id: 'R1', name: 'Archive', addressId: 'A1' });
      service.deleteAddress(repo.getAddress('A1')!);
      repo.updateRepository({ ...repo.getRepository('R1')!, addressId: 'A2' });
      service.undo();
      expect(repo.getRepository('R1')?.addressId).toBe('A2');
      expect(service.redo().redoBlocked).toBeUndefined();
      expect(repo.getAddress('A1')).toBeUndefined();
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('allows person redo when a cited source vanished before undo', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1'));
      service.addSource({ id: 'S1', title: 'Book' });
      service.addFact({ id: 'F1', personId: 'P1', tag: 'BIRT' });
      service.attachSource('S1', 'fact', 'F1');
      service.deletePerson(repo.getPerson('P1')!);
      repo.deleteSource('S1');
      service.undo();
      expect(repo.getPerson('P1')).toBeDefined();
      expect(repo.listAttachmentsFor('fact', 'F1').citations).toEqual([]);
      expect(service.redo().redoBlocked).toBeUndefined();
      expect(repo.getPerson('P1')).toBeUndefined();
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('restores only the place references the latest delete removed', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1'));
      service.addPlace({ id: 'P1P', names: [{ id: 'PN1', kind: 'official', position: 0, value: 'A' }] });
      service.addPlace({ id: 'P2P', names: [{ id: 'PN2', kind: 'official', position: 0, value: 'B' }] });
      service.addFact({ id: 'F1', personId: 'P1', tag: 'BIRT', placeId: 'P1P' });
      service.deletePlace(repo.getPlace('P1P')!);
      repo.updateFact({ ...repo.getFact('F1')!, placeId: 'P2P' });
      service.undo();
      expect(repo.getFact('F1')?.placeId).toBe('P2P');
      expect(service.redo().redoBlocked).toBeUndefined();
      repo.updateFact({ ...repo.getFact('F1')!, placeId: undefined });
      service.undo();
      expect(repo.getFact('F1')?.placeId).toBeUndefined();
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('allows title redo after a source moved to another title before undo', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addTitle({ id: 'T1', name: 'Register' });
      service.addTitle({ id: 'T2', name: 'Other' });
      service.addSource({ id: 'S1', title: 'Book', titleId: 'T1' });
      service.deleteTitle(repo.getTitle('T1')!);
      repo.updateSource({ ...repo.getSource('S1')!, titleId: 'T2' });
      service.undo();
      expect(repo.getSource('S1')?.titleId).toBe('T2');
      expect(service.redo().redoBlocked).toBeUndefined();
      expect(repo.getTitle('T1')).toBeUndefined();
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('rejects family redo when a saved member is missing', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('A'));
      service.addPerson(person('B'));
      service.addFamily(family('F1', { partners: ['A'], children: ['B'] }));
      service.undo();
      repo.deletePerson('B');
      expect(service.redo().redoBlocked).toBe(true);
      expect(repo.getFamily('F1')).toBeUndefined();
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('blocks family redo when a removed link gained evidence after undo', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('A'));
      service.addPerson(person('B'));
      service.addFamily(family('F1', { partners: ['A'], children: ['B'] }));
      const before = repo.getFamily('F1')!;
      const link = before.childLinks![0]!;
      service.updateFamily(before, { ...before, children: [], childLinks: [] });
      service.undo();
      repo.insertNote({
        id: 'N1',
        text: 'evidence added after undo',
        targetType: 'family_child',
        targetId: link.id,
      });
      expect(service.redo().redoBlocked).toBe(true);
      expect(repo.getFamily('F1')?.childLinks?.map((entry) => entry.id)).toEqual([link.id]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('remaps an adoption link added after the reorder was undone', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('A'));
      service.addPerson(person('B'));
      service.addPerson(person('C'));
      service.addFamily(family('F1', { partners: ['A', 'B'], children: ['C'] }));
      const before = repo.getFamily('F1')!;
      service.updateFamily(before, { ...before, partners: ['B', 'A'] });
      service.undo();
      repo.insertFact({
        id: 'ADOP1',
        personId: 'C',
        tag: 'ADOP',
        familyLinks: [{ id: 'FF1', familyId: 'F1', adoptedBy: 'HUSB', position: 0 }],
      });
      expect(service.redo().redoBlocked).toBeUndefined();
      expect(repo.getFamily('F1')?.partners).toEqual(['B', 'A']);
      expect(repo.getFact('ADOP1')?.familyLinks?.[0]?.adoptedBy).toBe('WIFE');
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('allows place redo after a source event moved to another place before undo', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPlace({ id: 'P1P', names: [{ id: 'PN1', kind: 'official', position: 0, value: 'A' }] });
      service.addPlace({ id: 'P2P', names: [{ id: 'PN2', kind: 'official', position: 0, value: 'B' }] });
      service.addSource({
        id: 'S1',
        title: 'Book',
        dataEvents: [{ id: 'E1', tag: 'DATA', placeId: 'P1P' }],
      });
      service.deletePlace(repo.getPlace('P1P')!);
      repo.updateSource({
        ...repo.getSource('S1')!,
        dataEvents: [{ id: 'E1', tag: 'DATA', placeId: 'P2P' }],
      });
      service.undo();
      expect(repo.getSource('S1')?.dataEvents?.[0]?.placeId).toBe('P2P');
      expect(service.redo().redoBlocked).toBeUndefined();
      expect(repo.getPlace('P1P')).toBeUndefined();
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('blocks alias redo when an endpoint disappeared', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1'));
      service.addPerson(person('P2'));
      service.addAlias('P1', 'P2');
      service.undo();
      repo.deletePerson('P2');
      expect(service.redo().redoBlocked).toBe(true);
    } finally {
      cleanupRepo(fixture);
    }
  });
});
