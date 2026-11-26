import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpQueue } from '../src/ops/op';
import { TreeService } from '../src/service/tree';
import type {
  AddressRecord,
  FactRecord,
  FamilyRecord,
  MediaRecord,
  PersonRecord,
  PlaceRecord,
  RepositoryRecord,
  SourceRecord,
  SubmitterRecord,
  TitleRecord,
} from '../src/model/types';
import { cleanupRepo, makeRepo } from './helpers';

const FIRST = new Date('2026-01-01T00:00:00Z').getTime();
const SECOND = new Date('2026-01-02T00:00:00Z').getTime();
const THIRD = new Date('2026-01-03T00:00:00Z').getTime();
const FOURTH = new Date('2026-01-04T00:00:00Z').getTime();

const person = (id: string, overrides: Partial<PersonRecord> = {}): PersonRecord => ({
  id,
  sex: 'U',
  names: [],
  facts: [],
  ...overrides,
});

const family = (id: string, overrides: Partial<FamilyRecord> = {}): FamilyRecord => ({
  id,
  partners: ['P1'],
  children: [],
  ...overrides,
});

const source = (id: string, overrides: Partial<SourceRecord> = {}): SourceRecord => ({
  id,
  title: 'Source',
  ...overrides,
});

const media = (id: string, overrides: Partial<MediaRecord> = {}): MediaRecord => ({
  id,
  path: 'media/photo.jpg',
  ...overrides,
});

const place = (id: string, overrides: Partial<PlaceRecord> = {}): PlaceRecord => ({
  id,
  names: [{ id: `${id}-name`, kind: 'official', position: 0, value: 'Moscow' }],
  ...overrides,
});

const repository = (id: string): RepositoryRecord => ({ id, name: 'Archive' });

const submitter = (id: string): SubmitterRecord => ({ id, name: 'Submitter' });

const address = (id: string): AddressRecord => ({
  id,
  lines: [{ id: `${id}-line`, value: '12 Archive Lane' }],
});

const title = (id: string): TitleRecord => ({ id, name: 'Parish register' });

function makeService() {
  const fixture = makeRepo();
  const service = new TreeService(fixture.repo, new OpQueue());
  return { fixture, service };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('record timestamps', () => {
  it('stamps every top-level record on create and preserves creation on edit', () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIRST);
    const { fixture, service } = makeService();
    try {
      service.addPerson(person('P1', { sex: 'F' }));
      service.addPerson(person('P2', { sex: 'M' }));
      service.addFamily(family('F1'));
      service.addSource(source('S1'));
      service.addMedia(media('M1'));
      service.addPlace(place('PL1'));
      service.addRepository(repository('R1'));
      service.addSubmitter(submitter('U1'));
      service.addAddress(address('A1'));
      service.addTitle(title('T1'));

      for (const record of [
        service.getPerson('P1'),
        fixture.repo.getFamily('F1'),
        fixture.repo.getSource('S1'),
        service.getMedia('M1'),
        service.getPlace('PL1'),
        fixture.repo.getRepository('R1'),
        fixture.repo.getSubmitter('U1'),
        service.getAddress('A1'),
        fixture.repo.getTitle('T1'),
      ]) {
        expect(record).toMatchObject({ createdAt: FIRST, updatedAt: FIRST });
      }

      vi.setSystemTime(SECOND);
      service.updatePerson(service.getPerson('P1')!, { ...service.getPerson('P1')!, sex: 'M' });
      service.updateFamily(fixture.repo.getFamily('F1')!, {
        ...fixture.repo.getFamily('F1')!,
        unionStatus: 'married',
      });
      service.updateSource(fixture.repo.getSource('S1')!, { ...fixture.repo.getSource('S1')!, title: 'Edited' });
      service.updateMedia(service.getMedia('M1')!, { ...service.getMedia('M1')!, title: 'Edited' });
      service.updatePlace(service.getPlace('PL1')!, {
        ...service.getPlace('PL1')!,
        names: [{ id: 'PL1-name', kind: 'official', position: 0, value: 'Tver' }],
      });
      service.updateRepository(fixture.repo.getRepository('R1')!, {
        ...fixture.repo.getRepository('R1')!,
        name: 'Edited',
      });
      service.updateSubmitter(fixture.repo.getSubmitter('U1')!, {
        ...fixture.repo.getSubmitter('U1')!,
        name: 'Edited',
      });
      service.updateAddress(service.getAddress('A1')!, { ...service.getAddress('A1')!, city: 'Tver' });
      service.updateTitle(fixture.repo.getTitle('T1')!, { ...fixture.repo.getTitle('T1')!, author: 'Edited' });

      for (const record of [
        service.getPerson('P1'),
        fixture.repo.getFamily('F1'),
        fixture.repo.getSource('S1'),
        service.getMedia('M1'),
        service.getPlace('PL1'),
        fixture.repo.getRepository('R1'),
        fixture.repo.getSubmitter('U1'),
        service.getAddress('A1'),
        fixture.repo.getTitle('T1'),
      ]) {
        expect(record).toMatchObject({ createdAt: FIRST, updatedAt: SECOND });
      }
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('does not stamp a source update that changes no content', () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIRST);
    const { fixture, service } = makeService();
    try {
      service.addSource(source('S1'));
      vi.setSystemTime(SECOND);
      const stored = fixture.repo.getSource('S1')!;
      service.updateSource(stored, { ...stored });
      expect(fixture.repo.getSource('S1')).toMatchObject({ createdAt: FIRST, updatedAt: FIRST });
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('moves the owner edit instant with add, update and delete of a fact, including undo', () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIRST);
    const { fixture, service } = makeService();
    try {
      service.addPerson(person('P1'));
      vi.setSystemTime(SECOND);
      const fact: FactRecord = { id: 'FACT1', personId: 'P1', tag: 'BIRT', value: 'first' };
      service.addFact(fact);
      expect(service.getPerson('P1')).toMatchObject({ createdAt: FIRST, updatedAt: SECOND });

      service.undo();
      expect(service.getPerson('P1')).toMatchObject({ createdAt: FIRST, updatedAt: FIRST });
      service.redo();
      expect(service.getPerson('P1')).toMatchObject({ createdAt: FIRST, updatedAt: SECOND });

      vi.setSystemTime(THIRD);
      const stored = fixture.repo.getFact('FACT1')!;
      service.updateFact(stored, { ...stored, value: 'second' });
      expect(service.getPerson('P1')).toMatchObject({ createdAt: FIRST, updatedAt: THIRD });
      service.undo();
      expect(service.getPerson('P1')).toMatchObject({ createdAt: FIRST, updatedAt: SECOND });

      vi.setSystemTime(FOURTH);
      service.deleteFact(fixture.repo.getFact('FACT1')!);
      expect(service.getPerson('P1')).toMatchObject({ createdAt: FIRST, updatedAt: FOURTH });
      expect(fixture.repo.getFact('FACT1')).toBeUndefined();
      service.undo();
      expect(service.getPerson('P1')).toMatchObject({ createdAt: FIRST, updatedAt: SECOND });
      expect(fixture.repo.getFact('FACT1')).toBeDefined();
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('does not stamp an unchanged fact and keeps a newer owner stamp on undo', () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIRST);
    const { fixture, service } = makeService();
    try {
      service.addPerson(person('P1'));
      vi.setSystemTime(SECOND);
      service.addFact({ id: 'FACT1', personId: 'P1', tag: 'BIRT', value: 'first' });

      vi.setSystemTime(THIRD);
      const stored = fixture.repo.getFact('FACT1')!;
      service.updateFact(stored, stored);
      expect(service.getPerson('P1')).toMatchObject({ createdAt: FIRST, updatedAt: SECOND });

      fixture.repo.setPersonUpdatedAt('P1', FOURTH);
      service.undo();
      expect(service.getPerson('P1')).toMatchObject({ createdAt: FIRST, updatedAt: FOURTH });
      expect(fixture.repo.getFact('FACT1')).toBeUndefined();

      const redo = service.redo();
      expect(redo.redoBlocked).toBe(true);
      expect(fixture.repo.getFact('FACT1')).toBeUndefined();
      expect(service.getPerson('P1')).toMatchObject({ createdAt: FIRST, updatedAt: FOURTH });
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('does not move the host edit instant for notes, citations, media or task links', () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIRST);
    const { fixture, service } = makeService();
    try {
      service.addPerson(person('P1'));
      service.addSource(source('S1'));
      service.addMedia(media('M1'));
      service.addTask({
        id: 'T1',
        text: 'Task',
        targets: [],
        priority: 'medium',
        status: 'open',
      });

      vi.setSystemTime(SECOND);
      service.addNote({
        id: 'N1',
        text: 'Note',
        targetType: 'person',
        targetId: 'P1',
      });
      service.attachSource('S1', 'person', 'P1');
      service.attachMedia({ id: 'ML1', mediaId: 'M1', targetType: 'person', targetId: 'P1' });
      service.addTaskLink({ id: 'TL1', taskId: 'T1', targetType: 'person', targetId: 'P1' });

      expect(service.getPerson('P1')).toMatchObject({ createdAt: FIRST, updatedAt: FIRST });
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('stamps family membership changes and restores the previous instant on undo', () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIRST);
    const { fixture, service } = makeService();
    try {
      service.addPerson(person('P1'));
      service.addPerson(person('P2'));
      service.addRelative('spouse', 'P1', person('P3'));
      const created = service.listFamilies()[0]!;
      expect(created).toMatchObject({ createdAt: FIRST, updatedAt: FIRST });

      vi.setSystemTime(SECOND);
      service.addRelative('child', 'P1', person('P4'));
      expect(fixture.repo.getFamily(created.id)).toMatchObject({ createdAt: FIRST, updatedAt: SECOND });
      service.undo();
      expect(fixture.repo.getFamily(created.id)).toMatchObject({ createdAt: FIRST, updatedAt: FIRST });
      expect(service.getPerson('P4')).toBeUndefined();

      vi.setSystemTime(THIRD);
      service.deletePerson(service.getPerson('P3')!);
      expect(fixture.repo.getFamily(created.id)).toMatchObject({ createdAt: FIRST, updatedAt: FIRST });
      service.undo();
      expect(fixture.repo.getFamily(created.id)).toMatchObject({ createdAt: FIRST, updatedAt: FIRST });
      expect(service.getPerson('P3')).toBeDefined();
    } finally {
      cleanupRepo(fixture);
    }
  });
});
