import { describe, expect, it } from 'vitest';
import { emptyAttachments } from '../src/model/types';
import type { MutationContext } from '../src/ops/op';
import {
  attachmentsMatch,
  restoreAlias,
  restoreAssociation,
  restoreCitation,
  restoreFact,
  restoreFamily,
  attachmentTargetExists,
  restoreMedia,
  restorePerson,
  restorePlace,
  restoreRecordSubmitter,
  restoreSource,
  restoreSourceRepository,
  restoreTitle,
  restoreTask,
  sameRecord,
} from '../src/ops/restore';
import { cleanupRepo, makeRepo, type RepoFixture } from './helpers';

function context(fixture: RepoFixture): MutationContext {
  return { repo: fixture.repo };
}

describe('undo restore sanitizers', () => {
  it('skips facts whose owner is gone and drops dangling references otherwise', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      const ctx = context(fixture);
      expect(restoreFact(ctx, { id: 'F0', personId: 'missing', tag: 'BIRT' })).toBe(false);
      expect(restoreFact(ctx, { id: 'F00', familyId: 'missing', tag: 'MARR' })).toBe(false);

      repo.insertPerson({ id: 'P1', names: [], sex: 'U', facts: [] });
      repo.insertPlace({ id: 'PL1', names: [{ id: 'PN1', kind: 'official', position: 0, value: 'Moscow' }] });
      repo.insertFamily({ id: 'F1', partners: ['P1'], children: [] });

      expect(
        restoreFact(ctx, {
          id: 'F1',
          personId: 'P1',
          tag: 'BIRT',
          placeId: 'missing',
          addressId: 'missing',
          additionalPlaceIds: ['missing', 'PL1'],
          familyLinks: [{ id: 'FL1', familyId: 'missing', position: 0 }],
          participants: [{ id: 'PT1', personId: 'missing', position: 0 }],
        }),
      ).toBe(true);
      const stored = repo.getFact('F1')!;
      expect(stored.placeId).toBeUndefined();
      expect(stored.addressId).toBeUndefined();
      expect(stored.additionalPlaceIds).toEqual(['PL1']);
      expect(stored.familyLinks).toBeUndefined();
      expect(stored.participants?.[0]).toMatchObject({ id: 'PT1' });
      expect(stored.participants?.[0]?.personId).toBeUndefined();
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('restores a place without hierarchy links to deleted parents', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      const ctx = context(fixture);
      repo.insertPlace({ id: 'P1', names: [{ id: 'PN1', kind: 'official', position: 0, value: 'Parent' }] });
      restorePlace(ctx, {
        id: 'PL1',
        names: [{ id: 'PN2', kind: 'official', position: 0, value: 'Child' }],
        hierarchy: [
          { id: 'H1', parentId: 'missing' },
          { id: 'H2', parentId: 'P1' },
        ],
      });
      expect(repo.getPlace('PL1')?.hierarchy?.map((link) => link.id)).toEqual(['H2']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('restores a person without dangling address or fact references', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      const ctx = context(fixture);
      restorePerson(ctx, {
        id: 'P1',
        sex: 'U',
        addressId: 'missing',
        names: [{ id: 'N1', given: 'Ada', variants: [{ id: 'N2', given: 'Ada', language: 'ru' }] }],
        facts: [
          { id: 'F1', personId: 'P1', tag: 'BIRT', placeId: 'missing' },
          { id: 'F2', personId: 'missing', tag: 'DEAT' },
        ],
      });
      const stored = repo.getPerson('P1')!;
      expect(stored.addressId).toBeUndefined();
      expect(stored.names[0]?.variants?.[0]?.id).toBe('N2');
      expect(stored.facts.map((fact) => fact.id)).toEqual(['F1']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('drops missing places from family statuses, media and source events', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      const ctx = context(fixture);
      repo.insertPerson({ id: 'P1', names: [], sex: 'U', facts: [] });
      restoreFamily(ctx, {
        id: 'F1',
        partners: ['P1'],
        children: [],
        marriageStatuses: [{ id: 'MS1', status: 'married', placeId: 'missing' }],
      });
      expect(repo.getFamily('F1')?.marriageStatuses?.[0]?.id).toBe('MS1');
      expect(repo.getFamily('F1')?.marriageStatuses?.[0]?.placeId).toBeUndefined();

      restoreMedia(ctx, { id: 'M1', path: 'media/m1.jpg', title: 'Photo' });
      expect(repo.getMedia('M1')?.title).toBe('Photo');

      restoreSource(ctx, {
        id: 'S1',
        title: 'Book',
        titleId: 'missing',
        dataEvents: [{ id: 'SE1', tag: 'DATA', placeId: 'missing' }],
        repositories: [{ id: 'SR1', repositoryId: 'missing' }],
      });
      const source = repo.getSource('S1')!;
      expect(source.titleId).toBeUndefined();
      expect(source.dataEvents?.[0]?.id).toBe('SE1');
      expect(source.dataEvents?.[0]?.placeId).toBeUndefined();
      expect(source.repositories).toBeUndefined();
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('restores sources and media when their optional targets survive', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      const ctx = context(fixture);
      repo.insertPlace({ id: 'PL1', names: [{ id: 'PN1', kind: 'official', position: 0, value: 'Moscow' }] });
      repo.insertTitle({ id: 'TI1', name: 'Work' });
      repo.insertRepository({ id: 'R1', name: 'Archive' });
      restoreSource(ctx, {
        id: 'S1',
        title: 'Book',
        titleId: 'TI1',
        dataEvents: [{ id: 'SE1', tag: 'DATA', placeId: 'PL1' }],
        repositories: [{ id: 'SR1', repositoryId: 'R1' }],
      });
      expect(repo.getSource('S1')?.titleId).toBe('TI1');
      expect(repo.getSource('S1')?.dataEvents?.[0]?.placeId).toBe('PL1');
      expect(repo.getSource('S1')?.repositories?.[0]?.repositoryId).toBe('R1');

      restoreMedia(ctx, { id: 'M1', path: 'media/m1.jpg', title: 'Photo' });
      expect(repo.getMedia('M1')?.title).toBe('Photo');

      repo.insertPerson({ id: 'P1', names: [], sex: 'U', facts: [] });
      restoreFamily(ctx, {
        id: 'F1',
        partners: ['P1'],
        children: [],
        marriageStatuses: [{ id: 'MS1', status: 'married', placeId: 'PL1' }],
      });
      expect(repo.getFamily('F1')?.marriageStatuses?.[0]?.placeId).toBe('PL1');
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('skips citations, associations and aliases whose targets vanished', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      const ctx = context(fixture);
      expect(restoreCitation(ctx, { id: 'C0', sourceId: 'missing', targetType: 'person', targetId: 'P1' })).toBe(false);
      repo.insertSource({ id: 'S1', title: 'Book' });
      repo.insertPerson({ id: 'P1', names: [], sex: 'U', facts: [] });
      expect(restoreCitation(ctx, { id: 'C1', sourceId: 'S1', targetType: 'person', targetId: 'P1' })).toBe(true);
      expect(repo.getCitation('C1')).toBeDefined();
      expect(restoreCitation(ctx, { id: 'C2', sourceId: 'S1', targetType: 'person', targetId: 'missing' })).toBe(false);
      expect(repo.getCitation('C2')).toBeUndefined();

      repo.insertPerson({ id: 'P2', names: [], sex: 'U', facts: [] });
      repo.insertFamily({ id: 'F1', partners: ['P1'], children: [] });
      expect(restoreCitation(ctx, { id: 'C3', sourceId: 'S1', targetType: 'family', targetId: 'F1' })).toBe(true);
      expect(restoreAssociation(ctx, { id: 'A1', personId: 'P1', otherPersonId: 'P2', role: 'witness' })).toBe(true);
      expect(restoreAssociation(ctx, { id: 'A2', personId: 'P1', otherPersonId: 'missing' })).toBe(false);
      expect(restoreAssociation(ctx, { id: 'A3', personId: 'missing', otherPersonId: 'P2' })).toBe(false);
      expect(restoreAssociation(ctx, { id: 'A4', familyId: 'missing', otherPersonId: 'P2' })).toBe(false);
      expect(restoreAssociation(ctx, { id: 'A5', familyId: 'F1', otherPersonId: 'P2' })).toBe(true);

      expect(restoreAlias(ctx, 'AL1', 'P1', 'P2')).toBe(true);
      expect(restoreAlias(ctx, 'AL2', 'P1', 'missing')).toBe(false);
      expect(restoreAlias(ctx, 'AL3', 'missing', 'P2')).toBe(false);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('restores tasks, titles, submitters and source links with live targets', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      const ctx = context(fixture);
      repo.insertRepository({ id: 'R1', name: 'Archive' });
      restoreTask(ctx, { id: 'T1', text: 'Task', targets: [] });
      restoreTask(ctx, {
        id: 'T2',
        text: 'Orphan task',
        targets: [{ id: 'TL2', taskId: 'T2', targetType: 'person', targetId: 'missing' }],
      });
      restoreTask(ctx, {
        id: 'T3',
        text: 'Linked task',
        targets: [{ id: 'TL3', taskId: 'T3', targetType: 'repository', targetId: 'R1' }],
      });
      expect(repo.getTask('T1')?.id).toBe('T1');
      expect(repo.getTask('T3')?.targets).toEqual([
        expect.objectContaining({ targetType: 'repository', targetId: 'R1' }),
      ]);
      expect(repo.getTask('T2')?.id).toBe('T2');
      expect(repo.getTask('T2')?.targets).toEqual([]);

      restoreTitle(ctx, { id: 'TI1', name: 'Work', repositoryId: 'R1' });
      restoreTitle(ctx, { id: 'TI2', name: 'Orphan work', repositoryId: 'missing' });
      expect(repo.getTitle('TI1')?.repositoryId).toBe('R1');
      expect(repo.getTitle('TI2')?.id).toBe('TI2');
      expect(repo.getTitle('TI2')?.repositoryId).toBeUndefined();

      repo.insertPerson({ id: 'P1', names: [], sex: 'U', facts: [] });

      repo.insertSubmitter({ id: 'SU1', name: 'Submitter' });
      expect(
        restoreRecordSubmitter(ctx, {
          id: 'RS1',
          submitterId: 'SU1',
          targetType: 'person',
          targetId: 'P1',
          kind: 'contributor',
        }),
      ).toBe(true);
      expect(
        restoreRecordSubmitter(ctx, {
          id: 'RS2',
          submitterId: 'missing',
          targetType: 'person',
          targetId: 'P1',
        }),
      ).toBe(false);
      expect(
        restoreRecordSubmitter(ctx, {
          id: 'RS3',
          submitterId: 'SU1',
          targetType: 'person',
          targetId: 'P1',
        }),
      ).toBe(true);

      repo.insertSource({ id: 'S1', title: 'Book' });
      expect(
        restoreSourceRepository(ctx, {
          id: 'SR1',
          sourceId: 'S1',
          repositoryId: 'R1',
          callNumbers: [{ id: 'CN1', value: '1' }],
        }),
      ).toBe(true);
      expect(restoreSourceRepository(ctx, { id: 'SR2', sourceId: 'missing', repositoryId: 'R1' })).toBe(false);
      expect(restoreSourceRepository(ctx, { id: 'SR3', sourceId: 'S1', repositoryId: 'missing' })).toBe(false);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('filters media links and clears a task target when it vanished', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      const ctx = context(fixture);
      repo.insertPerson({ id: 'P1', names: [], sex: 'U', facts: [] });
      const restored = restoreMedia(ctx, {
        id: 'M1',
        path: 'media/m1.jpg',
        title: 'Photo',
        links: [
          { id: 'L1', mediaId: 'M1', targetType: 'person', targetId: 'P1' },
          { id: 'L2', mediaId: 'M1', targetType: 'person', targetId: 'missing' },
        ],
      });
      expect([...restored]).toEqual(['L1']);
      expect(repo.getMedia('M1')?.links?.map((link) => link.id)).toEqual(['L1']);

      const noLinks = restoreMedia(ctx, {
        id: 'M2',
        path: 'media/m2.jpg',
        title: 'Standalone',
        links: [{ id: 'L3', mediaId: 'M2', targetType: 'person', targetId: 'missing' }],
      });
      expect([...noLinks]).toEqual([]);
      expect(repo.getMedia('M2')?.links).toEqual([]);

      restoreTask(ctx, {
        id: 'T1',
        text: 'Task',
        targets: [{ id: 'TL1', taskId: 'T1', targetType: 'person', targetId: 'missing' }],
      });
      expect(repo.getTask('T1')?.id).toBe('T1');
      expect(repo.getTask('T1')?.targets).toEqual([]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('skips submitter links whose targets vanished', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      const ctx = context(fixture);
      repo.insertSubmitter({ id: 'SU1', name: 'Submitter' });
      expect(
        restoreRecordSubmitter(ctx, {
          id: 'RS1',
          submitterId: 'SU1',
          targetType: 'person',
          targetId: 'missing',
        }),
      ).toBe(false);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('checks every nested target kind used by citations', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      const ctx = context(fixture);
      repo.insertPerson({
        id: 'P1',
        names: [{ id: 'N1', given: 'Ada', parts: [{ id: 'NP1', kind: 'given', value: 'Ada', position: 0 }] }],
        sex: 'U',
        facts: [],
      });
      repo.insertFamily({
        id: 'F1',
        partners: ['P1'],
        children: ['P1'],
        partnerLinks: [{ id: 'FP1', personId: 'P1' }],
        childLinks: [{ id: 'FC1', childId: 'P1' }],
        marriageStatuses: [{ id: 'MS1', status: 'married' }],
      });
      repo.insertPlace({
        id: 'PL1',
        names: [{ id: 'PN1', kind: 'official', position: 0, value: 'Moscow' }],
        hierarchy: [{ id: 'PH1', parentId: 'PL1' }],
      });
      repo.insertAddress({ id: 'A1', lines: [{ id: 'AL1', value: 'Line' }] });
      repo.insertTitle({ id: 'TI1', name: 'Work' });

      for (const [type, id] of [
        ['family_partner', 'FP1'],
        ['family_child', 'FC1'],
        ['family_marriage_status', 'MS1'],
        ['place_name', 'PN1'],
        ['place_hierarchy', 'PH1'],
        ['address_line', 'AL1'],
        ['title', 'TI1'],
        ['name', 'N1'],
        ['name_part', 'NP1'],
      ] as const) {
        expect(attachmentTargetExists(ctx, type, id)).toBe(true);
      }
      expect(attachmentTargetExists(ctx, 'family_partner', 'missing')).toBe(false);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('reports which attachment targets still exist', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      const ctx = context(fixture);
      repo.insertPerson({ id: 'P1', names: [], sex: 'U', facts: [] });
      repo.insertFamily({ id: 'F1', partners: ['P1'], children: [] });
      repo.insertSource({ id: 'S1', title: 'Book' });
      repo.insertRepository({ id: 'R1', name: 'Archive' });
      repo.insertSubmitter({ id: 'SU1', name: 'Person' });
      repo.insertAddress({ id: 'A1', lines: [] });
      repo.insertTask({ id: 'T1', text: 'Task', targets: [] });
      repo.insertFact({ id: 'FACT1', personId: 'P1', tag: 'BIRT' });
      repo.insertAssociation({ id: 'AS1', personId: 'P1', otherPersonId: 'P1' });
      repo.insertMedia({ id: 'M1', path: 'media/m1.jpg', targetType: 'person', targetId: 'P1' });
      repo.insertPlace({ id: 'PL1', names: [] });

      for (const [type, id] of [
        ['fact', 'FACT1'],
        ['association', 'AS1'],
        ['person', 'P1'],
        ['place', 'PL1'],
        ['media', 'M1'],
        ['task', 'T1'],
        ['source', 'S1'],
        ['repository', 'R1'],
        ['submitter', 'SU1'],
        ['address', 'A1'],
      ] as const) {
        expect(attachmentTargetExists(ctx, type, id)).toBe(true);
      }
      expect(attachmentTargetExists(ctx, 'fact', 'missing')).toBe(false);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('compares records and attachment snapshots for redo safety', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      const ctx = context(fixture);
      expect(sameRecord({ id: 'A' }, { id: 'A' })).toBe(true);
      expect(sameRecord({ id: 'A' }, { id: 'B' })).toBe(false);

      const empty = repo.listAttachmentsFor('person', 'P1');
      expect(attachmentsMatch(ctx, 'person', 'P1', empty)).toBe(true);
      repo.insertNote({ id: 'N1', text: 'Note', targetType: 'person', targetId: 'P1' });
      expect(attachmentsMatch(ctx, 'person', 'P1', empty)).toBe(false);
      expect(attachmentsMatch(ctx, 'person', 'P1', emptyAttachments())).toBe(false);

      repo.insertTask({
        id: 'T1',
        text: 'Draft',
        targets: [{ id: 'TL1', taskId: 'T1', targetType: 'person', targetId: 'P1' }],
      });
      const withTask = repo.listAttachmentsFor('person', 'P1');
      expect(attachmentsMatch(ctx, 'person', 'P1', withTask)).toBe(true);
      repo.deleteTaskLink('TL1');
      expect(attachmentsMatch(ctx, 'person', 'P1', withTask)).toBe(false);

      repo.insertSource({ id: 'S1', title: 'Book' });
      repo.insertCitation({ id: 'C1', sourceId: 'S1', targetType: 'person', targetId: 'P1', page: '1' });
      repo.insertMedia({ id: 'M1', path: 'media/m1.jpg', title: 'Photo', targetType: 'person', targetId: 'P1' });
      repo.insertContact({ id: 'CT1', targetType: 'person', targetId: 'P1', kind: 'email', value: 'a@b.c' });
      repo.insertSubmitter({ id: 'SU1', name: 'Submitter' });
      repo.insertRecordSubmitter('RS1', 'SU1', 'person', 'P1', 'contributor');
      const rich = repo.listAttachmentsFor('person', 'P1');
      expect(attachmentsMatch(ctx, 'person', 'P1', rich)).toBe(true);
      repo.updateCitation({ ...rich.citations[0]!, page: '2' });
      expect(attachmentsMatch(ctx, 'person', 'P1', rich)).toBe(false);
    } finally {
      cleanupRepo(fixture);
    }
  });
});
