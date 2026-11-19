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
  it('blocks tag redo when a link date changed', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1'));
      service.addTag({ id: 'TAG1', name: 'Family' });
      service.attachTag({ id: 'TL1', tagId: 'TAG1', targetType: 'person', targetId: 'P1' });
      service.deleteTag(repo.listTags()[0]!);
      service.undo();
      const link = repo.listTagLinksByTag('TAG1')[0]!;
      repo.updateTagLink({ ...link, date: { quality: 'exact', component: { year: 1900 } } });
      expect(service.redo().redoBlocked).toBe(true);
    } finally {
      cleanupRepo(fixture);
    }
  });

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

  it('blocks media detach redo when a new link attachment appeared', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1'));
      service.addSource({ id: 'S1', title: 'Book' });
      service.addMedia({ id: 'M1', title: 'Photo', targetType: 'person', targetId: 'P1' });
      const link = repo.listAttachmentsFor('person', 'P1').mediaLinks[0]!.link;
      service.detachMedia(link);
      service.undo();
      repo.insertCitation({ id: 'C2', sourceId: 'S1', targetType: 'media_link', targetId: link.id });
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

  it('blocks repository redo when a task link was cleared', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addRepository({ id: 'R1', name: 'Archive' });
      service.addTodo({ id: 'T1', text: 'Task', repositoryId: 'R1' });
      service.deleteRepository(repo.getRepository('R1')!);
      service.undo();
      repo.updateTodo({ ...repo.getTodo('T1')!, repositoryId: undefined });
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
      service.addTag({ id: 'TAG1', name: 'Family' });
      service.attachTag({ id: 'TL1', tagId: 'TAG1', targetType: 'person', targetId: 'P1' });
      const link = repo.listTagLinksByTag('TAG1')[0]!;
      service.updateTagLink(link, { ...link, date: { quality: 'exact', component: { year: 1900 } } });
      service.undo();
      repo.deleteTagLink('TL1');
      expect(service.redo().redoBlocked).toBe(true);

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

  it('allows reparent redo when the graph is unchanged', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1'));
      service.addPerson(person('P2'));
      service.addPerson(person('C'));
      service.addFamily(family('F1', { partners: ['P1'], children: ['C'] }));
      service.addFamily(family('F2', { partners: ['P2'], children: [] }));
      service.reparent('C', 'P2');
      service.undo();
      expect(repo.getFamily('F1')?.children).toContain('C');
      expect(repo.getFamily('F2')?.children).not.toContain('C');
      expect(service.redo().redoBlocked).toBeUndefined();
      expect(repo.getFamily('F2')?.children).toContain('C');
      expect(repo.getFamily('F1')?.children).not.toContain('C');
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('rejects reparent redo when the graph gained a cycle', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1'));
      service.addPerson(person('P2'));
      service.addPerson(person('C'));
      service.addFamily(family('F1', { partners: ['P1'], children: ['C'] }));
      service.addFamily(family('F2', { partners: ['P2'], children: [] }));
      service.reparent('C', 'P2');
      service.undo();
      repo.insertFamily({ id: 'F3', partners: ['C'], children: ['P2'] });
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
      service.addMedia({ id: 'M1', title: 'Photo', targetType: 'person', targetId: 'P1' });
      const link = repo.listAttachmentsFor('person', 'P1').mediaLinks[0]!.link;
      service.detachMedia(link);
      service.undo();
      repo.insertNote({ id: 'N1', text: 'new', targetType: 'media', targetId: 'M1' });
      expect(service.redo().redoBlocked).toBe(true);
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
