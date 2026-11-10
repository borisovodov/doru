import { describe, expect, it } from 'vitest';
import type { PersonRecord } from '../src/model/types';
import { OpQueue, TreeService } from '../src';
import { cleanupRepo, makeRepo } from './helpers';

function person(id: string): PersonRecord {
  return { id, sex: 'U', names: [], facts: [] };
}

function service(fixture: ReturnType<typeof makeRepo>): TreeService {
  return new TreeService(fixture.repo, new OpQueue());
}

describe('Phase 3: relations', () => {
  it('round-trips associations with a period and undo', () => {
    const fixture = makeRepo();
    try {
      const svc = service(fixture);
      const repo = fixture.repo;
      repo.insertPerson(person('P1'));
      repo.insertPerson(person('P2'));

      svc.addAssociation({
        id: 'A1',
        personId: 'P1',
        otherPersonId: 'P2',
        role: 'GODP',
        relationship: 'godparent',
        periodStart: { quality: 'exact', component: { year: 1900 } },
        periodEnd: { quality: 'exact', component: { year: 1905 } },
      });
      expect(repo.listAssociationsFor('P1')).toEqual([
        expect.objectContaining({ id: 'A1', otherPersonId: 'P2', relationship: 'godparent' }),
      ]);
      expect(repo.listAssociationsFor('P2')).toHaveLength(1);

      svc.undo();
      expect(repo.listAssociationsFor('P1')).toEqual([]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('round-trips aliases and ordinances', () => {
    const fixture = makeRepo();
    try {
      const svc = service(fixture);
      const repo = fixture.repo;
      repo.insertPerson(person('P1'));
      repo.insertPerson(person('P2'));

      svc.addAlias('P1', 'P2');
      expect(repo.listAliasesFor('P1').map((alias) => alias.aliasId)).toEqual(['P2']);

      svc.addOrdinance({
        id: 'O1',
        kind: 'BAPL',
        targetType: 'person',
        targetId: 'P1',
        date: { quality: 'exact', component: { year: 1920 } },
        temple: 'SALT',
        status: 'COMPLETED',
      });
      expect(repo.listOrdinancesFor('person', 'P1')).toEqual([
        expect.objectContaining({ id: 'O1', kind: 'BAPL', temple: 'SALT', status: 'COMPLETED' }),
      ]);
    } finally {
      cleanupRepo(fixture);
    }
  });
});

describe('Phase 3: research layer', () => {
  it('round-trips todos, evidence with findings and links, and research documents', () => {
    const fixture = makeRepo();
    try {
      const repo = fixture.repo;
      repo.insertPerson(person('P1'));

      repo.insertTodo({
        id: 'T1',
        text: 'check the archive',
        targetType: 'person',
        targetId: 'P1',
        priority: 'high',
        status: 'open',
        createdDate: { quality: 'exact', component: { year: 2026 } },
      });
      expect(repo.listTodosFor('person', 'P1')).toEqual([
        expect.objectContaining({ id: 'T1', text: 'check the archive', status: 'open' }),
      ]);

      repo.insertEvidence({
        id: 'E1',
        type: 'document',
        analysis: 'matches the birth year',
        findings: [
          {
            id: 'F1',
            type: 'birth',
            value: '1897',
            ageBound: '>',
            ageYears: 0,
          },
        ],
        links: [{ id: 'L1', evidenceId: 'E1', targetType: 'person', targetId: 'P1', confidence: 'high' }],
      });
      const evidence = repo.getEvidence('E1')!;
      expect(evidence.findings).toEqual([
        expect.objectContaining({ id: 'F1', type: 'birth', value: '1897', ageYears: 0 }),
      ]);
      expect(evidence.links).toEqual([
        expect.objectContaining({ id: 'L1', targetType: 'person', targetId: 'P1', confidence: 'high' }),
      ]);
      expect(repo.listEvidenceLinksFor('person', 'P1')).toHaveLength(1);

      repo.insertResearchDocument({
        id: 'D1',
        title: 'Notes on P1',
        text: 'body',
        subjectIds: ['P1'],
        conclusions: [{ id: 'C1', personId: 'P1', text: 'the year is 1897' }],
      });
      expect(repo.getResearchDocument('D1')).toEqual(
        expect.objectContaining({
          id: 'D1',
          subjectIds: ['P1'],
          conclusions: [expect.objectContaining({ id: 'C1', text: 'the year is 1897' })],
        }),
      );

      repo.insertResearchActivity({ id: 'R1', type: 'archive visit', researcher: 'me' });
      expect(repo.listResearchActivities()).toEqual([
        expect.objectContaining({ id: 'R1', type: 'archive visit' }),
      ]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('round-trips censuses, duplicates and titles', () => {
    const fixture = makeRepo();
    try {
      const repo = fixture.repo;
      repo.insertPerson(person('P1'));
      repo.insertPerson(person('P2'));

      repo.insertCensus({
        id: 'C1',
        schedule: '1897 census',
        entries: [
          { id: 'E1', personId: 'P1', ageValue: '3', occupation: 'none' },
          { id: 'E2', personId: 'P2', ageValue: '40' },
        ],
      });
      expect(repo.getCensus('C1')?.entries).toEqual([
        expect.objectContaining({ id: 'E1', personId: 'P1', ageValue: '3' }),
        expect.objectContaining({ id: 'E2', personId: 'P2', ageValue: '40' }),
      ]);

      repo.insertDuplicate({ id: 'D1', personId: 'P1', otherPersonId: 'P2', assessment: 'maybe' });
      expect(repo.listDuplicates()).toEqual([
        expect.objectContaining({ id: 'D1', personId: 'P1', otherPersonId: 'P2' }),
      ]);

      repo.insertTitle({ id: 'T1', name: 'Parish books of Tver', publisher: 'Archive', callNumber: 'F-123' });
      expect(repo.listTitles()).toEqual([
        expect.objectContaining({ id: 'T1', name: 'Parish books of Tver', callNumber: 'F-123' }),
      ]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('cascades ordinances, todos and evidence links with the person and restores them on undo', () => {
    const fixture = makeRepo();
    try {
      const svc = service(fixture);
      const repo = fixture.repo;
      const p = person('P1');
      repo.insertPerson(p);

      svc.addOrdinance({ id: 'O1', kind: 'BAPL', targetType: 'person', targetId: 'P1' });
      svc.addTodo({ id: 'T1', text: 'todo', targetType: 'person', targetId: 'P1' });
      repo.insertEvidence({
        id: 'E1',
        findings: [],
        links: [{ id: 'L1', evidenceId: 'E1', targetType: 'person', targetId: 'P1' }],
      });
      repo.insertSubmitter({ id: 'S1', name: 'Sub' });
      repo.insertRecordSubmitter('RS1', 'S1', 'person', 'P1');

      svc.deletePerson(p);
      expect(repo.listOrdinancesFor('person', 'P1')).toEqual([]);
      expect(repo.listTodosFor('person', 'P1')).toEqual([]);
      expect(repo.listEvidenceLinksFor('person', 'P1')).toEqual([]);
      expect(repo.listSubmittersFor('person', 'P1')).toEqual([]);
      // The evidence record and submitter survive; only the links go.
      expect(repo.getEvidence('E1')).toBeDefined();
      expect(repo.getSubmitter('S1')).toBeDefined();

      svc.undo();
      expect(repo.listOrdinancesFor('person', 'P1').map((entry) => entry.id)).toEqual(['O1']);
      expect(repo.listTodosFor('person', 'P1').map((entry) => entry.id)).toEqual(['T1']);
      expect(repo.listEvidenceLinksFor('person', 'P1').map((entry) => entry.id)).toEqual(['L1']);
      expect(repo.listSubmittersFor('person', 'P1')).toEqual(['S1']);
    } finally {
      cleanupRepo(fixture);
    }
  });
});
