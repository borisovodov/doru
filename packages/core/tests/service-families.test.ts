import { describe, expect, it } from 'vitest';
import type { FamilyRecord, PersonRecord } from '../src/model/types';
import { OpQueue } from '../src/ops/op';
import { TreeService } from '../src/service/tree';
import { cleanupRepo, makeRepo } from './helpers';

const person = (id: string, sex: PersonRecord['sex'] = 'U'): PersonRecord => ({
  id,
  names: [],
  sex,
  facts: [],
});

const family = (overrides: Partial<FamilyRecord> = {}): FamilyRecord => ({
  id: 'F1',
  partners: [],
  children: [],
  ...overrides,
});

function makeService() {
  const fixture = makeRepo();
  const service = new TreeService(fixture.repo, new OpQueue());
  return { fixture, service };
}

describe('TreeService families, persons and facts', () => {
  it('adds, updates and deletes families with undo', () => {
    const { fixture, service } = makeService();
    try {
      service.addPerson(person('P1'));
      service.addPerson(person('P2'));
      service.addPerson(person('K1'));
      service.addFamily(family({ partners: ['P1'], children: [] }));
      expect(fixture.repo.listFamilies().map((entry) => entry.id)).toEqual(['F1']);
      expect(fixture.repo.getFamily('F1')?.partners).toEqual(['P1']);

      const after = family({ partners: ['P1', 'P2'], children: ['K1'] });
      service.updateFamily(family({ partners: ['P1'], children: [] }), after);
      expect(fixture.repo.getFamily('F1')).toMatchObject({ partners: ['P1', 'P2'], children: ['K1'] });

      service.deleteFamily(after);
      expect(fixture.repo.listFamilies()).toEqual([]);
      service.undo();
      expect(fixture.repo.getFamily('F1')).toMatchObject({ partners: ['P1', 'P2'], children: ['K1'] });
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('deleteFamily snapshots the attachments of its partner and child links', () => {
    const { fixture, service } = makeService();
    try {
      service.addPerson(person('P1'));
      service.addPerson(person('K1'));
      service.addFamily(
        family({
          partners: ['P1'],
          children: ['K1'],
          partnerLinks: [{ id: 'PL1', personId: 'P1' }],
          childLinks: [{ id: 'CL1', childId: 'K1' }],
        }),
      );
      service.addNote({ id: 'N1', text: 'on the marriage', targetType: 'family_partner', targetId: 'PL1' });
      service.addNote({ id: 'N2', text: 'on the child link', targetType: 'family_child', targetId: 'CL1' });

      service.deleteFamily(fixture.repo.getFamily('F1')!);
      expect(fixture.repo.listFamilies()).toEqual([]);
      expect(fixture.repo.listNotesFor('family_partner', 'PL1')).toEqual([]);
      expect(fixture.repo.listNotesFor('family_child', 'CL1')).toEqual([]);

      service.undo();
      expect(fixture.repo.listNotesFor('family_partner', 'PL1').map((note) => note.id)).toEqual(['N1']);
      expect(fixture.repo.listNotesFor('family_child', 'CL1').map((note) => note.id)).toEqual(['N2']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('updates persons and facts with undo', () => {
    const { fixture, service } = makeService();
    try {
      service.addPerson(person('P1'));
      const renamed = person('P1', 'M');
      service.updatePerson(person('P1'), renamed);
      expect(fixture.repo.getPerson('P1')?.sex).toBe('M');

      service.addFact({ id: 'F1', personId: 'P1', tag: 'BIRT', date: { quality: 'exact', component: { year: 1923 } } });
      expect(fixture.repo.listFactsForPerson('P1')).toHaveLength(1);

      const afterFact = {
        id: 'F1',
        personId: 'P1',
        tag: 'BIRT',
        date: { quality: 'exact' as const, component: { year: 1924 } },
      };
      service.updateFact(fixture.repo.listFactsForPerson('P1')[0]!, afterFact);
      expect(fixture.repo.listFactsForPerson('P1')[0]?.date?.component?.year).toBe(1924);

      service.deleteFact(afterFact);
      expect(fixture.repo.listFactsForPerson('P1')).toEqual([]);
      service.undo();
      expect(fixture.repo.listFactsForPerson('P1')[0]?.date?.component?.year).toBe(1924);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('lists facts for a person or family and every fact otherwise', () => {
    const { fixture, service } = makeService();
    try {
      service.addPerson(person('P1'));
      service.addPerson(person('P2'));
      service.addFamily(family({ partners: ['P1', 'P2'], children: [] }));
      service.addFact({ id: 'F1', personId: 'P1', tag: 'BIRT', date: { quality: 'exact', component: { year: 1923 } } });
      service.addFact({ id: 'F2', familyId: 'F1', tag: 'MARR', date: { quality: 'exact', component: { year: 1945 } } });

      expect(service.listFactsFor('P1').map((fact) => fact.id)).toEqual(['F1']);
      expect(service.listFactsFor(undefined, 'F1').map((fact) => fact.id)).toEqual(['F2']);
      expect(service.listFactsFor()).toEqual([]);
      expect(service.listAllFacts().map((fact) => fact.id).sort()).toEqual(['F1', 'F2']);
      expect(service.listFamiliesForPerson('P1').map((entry) => entry.id)).toEqual(['F1']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('reports tree stats and all the collection listings', () => {
    const { fixture, service } = makeService();
    try {
      service.addPerson(person('P1'));
      service.addFamily(family({ partners: ['P1'], children: [] }));
      service.addNote({ id: 'N1', text: 'a note', targetType: 'person', targetId: 'P1' });
      service.addSource({ id: 'S1', title: 'The Source' });
      service.addMedia({ id: 'M1', path: 'media/a.jpg', title: 'Photo', targetType: 'person', targetId: 'P1' });

      expect(service.stats()).toEqual({ persons: 1, families: 1 });
      expect(service.listNotes().map((note) => note.id)).toEqual(['N1']);
      expect(service.listSources().map((source) => source.id)).toEqual(['S1']);
      expect(service.listAllMedia().map((media) => media.id)).toEqual(['M1']);
      expect(service.listAllCitations()).toEqual([]);
      expect(service.listAllPersons().map((entry) => entry.id)).toEqual(['P1']);
      expect(service.listPersons().map((entry) => entry.id)).toEqual(['P1']);
      expect(service.getPerson('P1')?.id).toBe('P1');
      expect(service.getPerson('missing')).toBeUndefined();
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('lists and searches places through the service', () => {
    const { fixture, service } = makeService();
    try {
      service.addPlace({
        id: 'PL1',
        names: [{ id: 'PN1', kind: 'official', position: 0, value: 'Moscow' }],
      });
      expect(service.listPlaces().map((place) => place.id)).toEqual(['PL1']);
      expect(service.searchPlaces('mosc').map((place) => place.id)).toEqual(['PL1']);
      expect(service.searchPlaces('zzz')).toEqual([]);
      expect(service.getPlace('PL1')?.id).toBe('PL1');
      expect(service.getPlace('missing')).toBeUndefined();
    } finally {
      cleanupRepo(fixture);
    }
  });
});
