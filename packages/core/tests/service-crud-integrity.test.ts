import { describe, expect, it } from 'vitest';
import type {
  AddressRecord,
  FamilyRecord,
  NoteRecord,
  PersonRecord,
  PlaceRecord,
  RepositoryRecord,
  SourceRecord,
  TaskRecord,
  TitleRecord,
} from '../src/model/types';
import { OpQueue } from '../src/ops/op';
import { TreeService } from '../src/service/tree';
import { cleanupRepo, makeRepo } from './helpers';
import type { RepoFixture } from './helpers';

function makeService() {
  const fixture = makeRepo();
  const service = new TreeService(fixture.repo, new OpQueue());
  return { fixture, service };
}

const person = (id: string, overrides: Partial<PersonRecord> = {}): PersonRecord => ({
  id,
  names: [],
  sex: 'U',
  facts: [],
  ...overrides,
});

const note = (id: string, targetType: string, targetId: string): NoteRecord => ({
  id,
  text: `note on ${targetId}`,
  targetType,
  targetId,
});

function dateRow(fixture: RepoFixture, id: string | undefined): unknown {
  return id === undefined ? undefined : fixture.store.db.prepare('SELECT id FROM date WHERE id = ?').get(id);
}

describe('TreeService CRUD integrity', () => {
  it('restores every place reference, attachment and date on undo', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      const parent: PlaceRecord = {
        id: 'PL1',
        names: [
          {
            id: 'PN1',
            kind: 'official',
            position: 0,
            value: 'Parent',
            date: { quality: 'exact', component: { year: 1900 } },
          },
        ],
        postalCodes: [{ id: 'PC1', code: '101000', date: { quality: 'exact', component: { year: 1901 } } }],
      };
      const child: PlaceRecord = {
        id: 'PL2',
        names: [{ id: 'PN2', kind: 'official', position: 0, value: 'Child' }],
        hierarchy: [
          {
            id: 'PH2',
            parentId: 'PL1',
            type: 'poli',
            date: { quality: 'exact', component: { year: 1902 } },
          },
        ],
      };
      const other: PlaceRecord = {
        id: 'PL3',
        names: [{ id: 'PN3', kind: 'official', position: 0, value: 'Other' }],
      };
      const source: SourceRecord = {
        id: 'S1',
        title: 'Register',
        dataEvents: [{ id: 'SDE1', tag: 'EVEN', placeId: 'PL1' }],
      };
      const family: FamilyRecord = {
        id: 'F1',
        partners: ['P1'],
        children: [],
        marriageStatuses: [
          {
            id: 'MS1',
            status: 'married',
            placeId: 'PL1',
            date: { quality: 'exact', component: { year: 1920 } },
          },
        ],
      };

      service.addPlace(parent);
      service.addPlace(child);
      service.addPlace(other);
      service.addPerson(
        person('P1', {
          facts: [
            { id: 'FACT1', personId: 'P1', tag: 'BIRT', placeId: 'PL1', place: 'Parent' },
            {
              id: 'FACT2',
              personId: 'P1',
              tag: 'RESI',
              additionalPlaceIds: ['PL1', 'PL3'],
            },
          ],
        }),
      );
      service.addFamily(family);
      service.addSource(source);
      service.addMedia({ id: 'M1', path: 'media/photo.jpg', placeId: 'PL1', targetType: 'person', targetId: 'P1' });
      service.addNote(note('N1', 'place', 'PL1'));
      service.addNote(note('N2', 'place_name', 'PN1'));
      service.addNote(note('N3', 'place_hierarchy', 'PH2'));
      service.addNote(note('N4', 'family_marriage_status', 'MS1'));

      const stored = repo.getPlace('PL1')!;
      const nameDateId = stored.names[0]?.date?.id;
      const postalDateId = stored.postalCodes?.[0]?.date?.id;
      const hierarchyDateId = repo.getPlace('PL2')?.hierarchy?.[0]?.date?.id;
      for (const id of [nameDateId, postalDateId, hierarchyDateId]) {
        expect(id).toBeDefined();
        expect(dateRow(fixture, id)).toBeDefined();
      }
      service.deletePlace(stored);

      expect(repo.getPlace('PL1')).toBeUndefined();
      expect(repo.listFactsForPerson('P1').find((fact) => fact.id === 'FACT1')?.placeId).toBeUndefined();
      expect(repo.listFactsForPerson('P1').find((fact) => fact.id === 'FACT2')?.additionalPlaceIds).toEqual(['PL3']);
      expect(repo.getFamily('F1')).toBeDefined();
      expect(repo.getFamily('F1')?.marriageStatuses?.[0]?.placeId).toBeUndefined();
      expect(repo.getSource('S1')).toBeDefined();
      expect(repo.getSource('S1')?.dataEvents?.[0]?.placeId).toBeUndefined();
      expect(repo.getMedia('M1')).toBeDefined();
      expect(repo.getMedia('M1')?.placeId).toBeUndefined();
      expect(repo.getPlace('PL2')).toBeDefined();
      expect(repo.getPlace('PL2')?.hierarchy).toBeUndefined();
      expect(repo.listNotesFor('place', 'PL1')).toEqual([]);
      expect(repo.listNotesFor('place_name', 'PN1')).toEqual([]);
      expect(repo.listNotesFor('place_hierarchy', 'PH2')).toEqual([]);
      // The place's name/postal dates and the parent-side hierarchy date go.
      expect(dateRow(fixture, nameDateId)).toBeUndefined();
      expect(dateRow(fixture, postalDateId)).toBeUndefined();
      expect(dateRow(fixture, hierarchyDateId)).toBeUndefined();

      service.undo();

      expect(repo.getPlace('PL1')?.names[0]?.value).toBe('Parent');
      expect(repo.getPlace('PL1')?.postalCodes?.[0]?.code).toBe('101000');
      expect(repo.listFactsForPerson('P1').find((fact) => fact.id === 'FACT1')?.placeId).toBe('PL1');
      expect(repo.listFactsForPerson('P1').find((fact) => fact.id === 'FACT2')?.additionalPlaceIds).toEqual([
        'PL1',
        'PL3',
      ]);
      expect(repo.getFamily('F1')?.marriageStatuses?.[0]?.placeId).toBe('PL1');
      expect(repo.getSource('S1')?.dataEvents?.[0]?.placeId).toBe('PL1');
      expect(repo.getMedia('M1')?.placeId).toBe('PL1');
      expect(repo.getPlace('PL2')?.hierarchy?.[0]?.parentId).toBe('PL1');
      expect(repo.listNotesFor('place', 'PL1').map((entry) => entry.id)).toEqual(['N1']);
      expect(repo.listNotesFor('place_name', 'PN1').map((entry) => entry.id)).toEqual(['N2']);
      expect(repo.listNotesFor('place_hierarchy', 'PH2').map((entry) => entry.id)).toEqual(['N3']);
      expect(repo.listNotesFor('family_marriage_status', 'MS1').map((entry) => entry.id)).toEqual(['N4']);
      expect(repo.getPlace('PL1')?.names[0]?.date?.component?.year).toBe(1900);
      expect(repo.getPlace('PL1')?.postalCodes?.[0]?.date?.component?.year).toBe(1901);
      expect(repo.getPlace('PL2')?.hierarchy?.[0]?.date?.component?.year).toBe(1902);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('restores media owned by a deleted place-name row, including media attachments', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPlace({
        id: 'PL1',
        names: [{ id: 'PN1', kind: 'official', position: 0, value: 'Tula' }],
      });
      service.addMedia({
        id: 'M1',
        targetType: 'place_name',
        targetId: 'PN1',
        files: [{ id: 'MF1', path: 'media/photo.jpg' }],
      });
      service.addNote({ id: 'NM1', text: 'media note', targetType: 'media', targetId: 'M1' });
      service.addNote({ id: 'NM2', text: 'file note', targetType: 'media_file', targetId: 'MF1' });

      service.deletePlace(repo.getPlace('PL1')!);
      expect(repo.getMedia('M1')).toBeUndefined();

      service.undo();
      expect(repo.getMedia('M1')?.id).toBe('M1');
      expect(repo.listAttachmentsFor('place_name', 'PN1').mediaLinks.some((entry) => entry.media.id === 'M1')).toBe(
        true,
      );
      expect(repo.listNotesFor('media', 'M1').map((entry) => entry.id)).toEqual(['NM1']);
      expect(repo.listNotesFor('media_file', 'MF1').map((entry) => entry.id)).toEqual(['NM2']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('restores media shared by several removed place-name rows', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPlace({
        id: 'PL1',
        names: [
          { id: 'PN1', kind: 'official', position: 0, value: 'Tula' },
          { id: 'PN2', kind: 'official', position: 1, value: 'Tula Oblast' },
        ],
      });
      service.addMedia({
        id: 'M1',
        files: [{ id: 'MF1', path: 'media/photo.jpg' }],
        links: [
          { id: 'ML1', mediaId: 'M1', targetType: 'place_name', targetId: 'PN1' },
          { id: 'ML2', mediaId: 'M1', targetType: 'place_name', targetId: 'PN2' },
        ],
      });
      service.addNote({ id: 'NM1', text: 'media note', targetType: 'media', targetId: 'M1' });

      service.deletePlace(repo.getPlace('PL1')!);
      expect(repo.getMedia('M1')).toBeUndefined();
      service.undo();
      expect(repo.listNotesFor('media', 'M1').map((entry) => entry.id)).toEqual(['NM1']);
      expect(repo.listAttachmentsFor('place_name', 'PN1').mediaLinks).toHaveLength(1);
      expect(repo.listAttachmentsFor('place_name', 'PN2').mediaLinks).toHaveLength(1);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('restores a person address and address-line attachment on undo', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      const address: AddressRecord = {
        id: 'AD1',
        lines: [
          { id: 'AL1', value: '12 Archive Lane' },
          { id: 'AL2', value: 'Building 3' },
        ],
        city: 'Moscow',
      };
      service.addAddress(address);
      service.addPerson(person('P1', { addressId: 'AD1' }));
      service.addNote(note('N1', 'address', 'AD1'));
      service.addNote(note('N2', 'address_line', 'AL2'));

      service.deleteAddress(repo.getAddress('AD1')!);

      expect(repo.getAddress('AD1')).toBeUndefined();
      expect(repo.getPerson('P1')).toBeDefined();
      expect(repo.getPerson('P1')?.addressId).toBeUndefined();
      expect(repo.listNotesFor('address', 'AD1')).toEqual([]);
      expect(repo.listNotesFor('address_line', 'AL2')).toEqual([]);

      service.undo();

      expect(repo.getAddress('AD1')?.lines.map((line) => line.value)).toEqual(['12 Archive Lane', 'Building 3']);
      expect(repo.getPerson('P1')?.addressId).toBe('AD1');
      expect(repo.listNotesFor('address', 'AD1').map((entry) => entry.id)).toEqual(['N1']);
      expect(repo.listNotesFor('address_line', 'AL2').map((entry) => entry.id)).toEqual(['N2']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('restores task and title repository links on undo', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      const repository: RepositoryRecord = { id: 'RP1', name: 'State Archive' };
      const task: TaskRecord = { id: 'T1', text: 'Order the record', repositoryId: 'RP1' };
      const title: TitleRecord = { id: 'TL1', name: 'The Parish Registers', repositoryId: 'RP1' };
      service.addRepository(repository);
      service.addTask(task);
      service.addTitle(title);

      service.deleteRepository(repository);

      expect(repo.getTask('T1')).toBeDefined();
      expect(repo.listTasks().find((entry) => entry.id === 'T1')?.repositoryId).toBeUndefined();
      expect(repo.getTitle('TL1')).toBeDefined();
      expect(repo.listTitles().find((entry) => entry.id === 'TL1')?.repositoryId).toBeUndefined();

      service.undo();

      expect(repo.listTasks().find((entry) => entry.id === 'T1')?.repositoryId).toBe('RP1');
      expect(repo.listTitles().find((entry) => entry.id === 'TL1')?.repositoryId).toBe('RP1');
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('restores family associations, marriage-status attachments and dates on undo', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1'));
      service.addPerson(person('P2'));
      service.addFamily({
        id: 'F1',
        partners: ['P1'],
        children: [],
        marriageStatuses: [
          {
            id: 'MS1',
            status: 'married',
            date: { quality: 'exact', component: { year: 1920 } },
          },
        ],
      });
      service.addAssociation({ id: 'A1', familyId: 'F1', otherPersonId: 'P2', role: 'witness' });
      service.addNote(note('N1', 'association', 'A1'));
      service.addNote(note('N2', 'family_marriage_status', 'MS1'));
      const personBefore = repo.getPerson('P1')!;
      service.updatePerson(personBefore, {
        ...personBefore,
        facts: [
          {
            id: 'ADOP1',
            personId: 'P1',
            tag: 'ADOP',
            familyLinks: [{ id: 'FF1', familyId: 'F1', adoptedBy: 'BOTH', position: 0 }],
          },
        ],
      });

      const statusDateId = repo.getFamily('F1')?.marriageStatuses?.[0]?.date?.id;
      expect(statusDateId).toBeDefined();
      expect(dateRow(fixture, statusDateId)).toBeDefined();
      service.deleteFamily(repo.getFamily('F1')!);

      expect(repo.listAssociationsForFamily('F1')).toEqual([]);
      expect(repo.listNotesFor('association', 'A1')).toEqual([]);
      expect(repo.listNotesFor('family_marriage_status', 'MS1')).toEqual([]);
      expect(repo.getPerson('P1')?.facts[0]?.familyLinks).toBeUndefined();
      expect(dateRow(fixture, statusDateId)).toBeUndefined();

      service.undo();

      expect(repo.listAssociationsForFamily('F1').map((entry) => entry.id)).toEqual(['A1']);
      expect(repo.getFamily('F1')?.marriageStatuses?.[0]?.id).toBe('MS1');
      expect(repo.getPerson('P1')?.facts[0]?.familyLinks?.[0]).toMatchObject({
        id: 'FF1',
        familyId: 'F1',
        adoptedBy: 'BOTH',
      });
      expect(repo.listNotesFor('association', 'A1').map((entry) => entry.id)).toEqual(['N1']);
      expect(repo.listNotesFor('family_marriage_status', 'MS1').map((entry) => entry.id)).toEqual(['N2']);
      expect(repo.getFamily('F1')?.marriageStatuses?.[0]?.date?.component?.year).toBe(1920);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('restores only the deleted family link on surviving facts', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1'));
      service.addFamily({ id: 'F1', partners: ['P1'], children: [] });
      service.addFamily({ id: 'F2', partners: ['P1'], children: [] });
      const personBefore = repo.getPerson('P1')!;
      service.updatePerson(personBefore, {
        ...personBefore,
        facts: [
          {
            id: 'ADOP1',
            personId: 'P1',
            tag: 'ADOP',
            familyLinks: [
              { id: 'FF1', familyId: 'F1', position: 0 },
              { id: 'FF2', familyId: 'F2', position: 1 },
            ],
          },
        ],
      });

      service.deleteFamily(repo.getFamily('F1')!);
      const surviving = repo.getPerson('P1')!.facts[0]!;
      repo.updateFact({ ...surviving, value: 'edited elsewhere' });

      service.undo();

      const restored = repo.getPerson('P1')!.facts[0]!;
      expect(restored.value).toBe('edited elsewhere');
      expect(restored.familyLinks?.map((link) => [link.id, link.familyId])).toEqual([
        ['FF1', 'F1'],
        ['FF2', 'F2'],
      ]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('cleans and restores place-name and place-hierarchy attachments on update', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPlace({ id: 'PL2', names: [{ id: 'PNP', kind: 'official', position: 0, value: 'Parent' }] });
      service.addPlace({
        id: 'PL1',
        names: [
          { id: 'PN1', kind: 'official', position: 0, value: 'One' },
          { id: 'PN2', kind: 'official', position: 1, value: 'Two' },
        ],
        hierarchy: [{ id: 'PH1', parentId: 'PL2', type: 'poli' }],
      });
      service.addNote(note('N1', 'place_name', 'PN2'));
      service.addNote(note('N2', 'place_hierarchy', 'PH1'));

      const before = repo.getPlace('PL1')!;
      service.updatePlace(before, {
        ...before,
        names: before.names.filter((name) => name.id === 'PN1'),
        hierarchy: undefined,
      });

      expect(repo.getPlace('PL1')?.names.map((name) => name.id)).toEqual(['PN1']);
      expect(repo.getPlace('PL1')?.hierarchy).toBeUndefined();
      expect(repo.listNotesFor('place_name', 'PN2')).toEqual([]);
      expect(repo.listNotesFor('place_hierarchy', 'PH1')).toEqual([]);

      service.undo();

      expect(repo.getPlace('PL1')?.names.map((name) => name.id)).toEqual(['PN1', 'PN2']);
      expect(repo.getPlace('PL1')?.hierarchy?.[0]?.id).toBe('PH1');
      expect(repo.listNotesFor('place_name', 'PN2').map((entry) => entry.id)).toEqual(['N1']);
      expect(repo.listNotesFor('place_hierarchy', 'PH1').map((entry) => entry.id)).toEqual(['N2']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('cleans and restores family marriage-status attachments on update', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1'));
      service.addPerson(person('P2'));
      service.addFamily({
        id: 'F1',
        partners: ['P1'],
        children: [],
        marriageStatuses: [
          { id: 'MS1', status: 'married' },
          { id: 'MS2', status: 'divorced' },
        ],
      });
      service.addNote(note('N1', 'family_marriage_status', 'MS2'));

      const before = repo.getFamily('F1')!;
      service.updateFamily(before, { ...before, marriageStatuses: [before.marriageStatuses![0]!] });

      expect(repo.getFamily('F1')?.marriageStatuses?.map((status) => status.id)).toEqual(['MS1']);
      expect(repo.listNotesFor('family_marriage_status', 'MS2')).toEqual([]);

      service.undo();

      expect(repo.getFamily('F1')?.marriageStatuses?.map((status) => status.id)).toEqual(['MS1', 'MS2']);
      expect(repo.listNotesFor('family_marriage_status', 'MS2').map((entry) => entry.id)).toEqual(['N1']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('cleans and restores address-line attachments on update', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addAddress({
        id: 'AD1',
        lines: [
          { id: 'AL1', value: '12 Archive Lane' },
          { id: 'AL2', value: 'Building 3' },
        ],
      });
      service.addNote(note('N1', 'address_line', 'AL2'));

      const before = repo.getAddress('AD1')!;
      service.updateAddress(before, { ...before, lines: before.lines.filter((line) => line.id === 'AL1') });

      expect(repo.getAddress('AD1')?.lines.map((line) => line.id)).toEqual(['AL1']);
      expect(repo.listNotesFor('address_line', 'AL2')).toEqual([]);

      service.undo();

      expect(repo.getAddress('AD1')?.lines.map((line) => line.id)).toEqual(['AL1', 'AL2']);
      expect(repo.listNotesFor('address_line', 'AL2').map((entry) => entry.id)).toEqual(['N1']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('cleans and restores name-part attachments on update', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(
        person('P1', {
          names: [
            {
              id: 'N1',
              parts: [
                { id: 'NP1', kind: 'given', value: 'Ivan', position: 0 },
                { id: 'NP2', kind: 'surname', value: 'Petrov', position: 1 },
              ],
            },
          ],
        }),
      );
      service.addNote(note('N1', 'name_part', 'NP2'));

      const before = repo.getPerson('P1')!;
      service.updatePerson(before, {
        ...before,
        names: [{ ...before.names[0]!, parts: [before.names[0]!.parts![0]!] }],
      });

      expect(repo.getPerson('P1')?.names[0]?.parts?.map((part) => part.id)).toEqual(['NP1']);
      expect(repo.listNotesFor('name_part', 'NP2')).toEqual([]);

      service.undo();

      expect(repo.getPerson('P1')?.names[0]?.parts?.map((part) => part.id)).toEqual(['NP1', 'NP2']);
      expect(repo.listNotesFor('name_part', 'NP2').map((entry) => entry.id)).toEqual(['N1']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('keeps name-part attachments when a flat name is saved', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1', { names: [{ id: 'N1', given: 'Ivan', surname: 'Petrov' }] }));
      const given = repo.getPerson('P1')!.names[0]!.parts!.find((part) => part.kind === 'given')!;
      service.addNote(note('NT1', 'name_part', given.id));

      const before = repo.getPerson('P1')!;
      service.updatePerson(before, {
        ...before,
        names: [{ id: 'N1', given: 'Ivan', surname: 'Petrov' }],
      });

      expect(repo.getPerson('P1')?.names[0]?.parts?.find((part) => part.kind === 'given')?.id).toBe(given.id);
      expect(repo.listNotesFor('name_part', given.id).map((entry) => entry.id)).toEqual(['NT1']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('keeps name-part attachments when a prefix shifts their positions', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1', { names: [{ id: 'N1', given: 'Ada', surname: 'Lovelace' }] }));
      const given = repo.getPerson('P1')!.names[0]!.parts!.find((part) => part.kind === 'given')!;
      service.addNote(note('NT1', 'name_part', given.id));

      const before = repo.getPerson('P1')!;
      service.updatePerson(before, {
        ...before,
        names: [{ id: 'N1', prefix: 'Dr', given: 'Ada', surname: 'Lovelace' }],
      });

      expect(repo.getPerson('P1')?.names[0]?.parts?.find((part) => part.kind === 'given')?.id).toBe(given.id);
      expect(repo.listNotesFor('name_part', given.id).map((entry) => entry.id)).toEqual(['NT1']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('matches a flat given part by value when two given parts exist', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(
        person('P1', {
          names: [
            {
              id: 'N1',
              parts: [
                { id: 'NP1', kind: 'given', value: 'Ada', position: 0 },
                { id: 'NP2', kind: 'given', value: 'Maria', position: 1 },
              ],
            },
          ],
        }),
      );
      service.addNote(note('NT1', 'name_part', 'NP1'));
      service.addNote(note('NT2', 'name_part', 'NP2'));

      const before = repo.getPerson('P1')!;
      service.updatePerson(before, {
        ...before,
        names: [{ id: 'N1', prefix: 'Dr', given: 'Maria' }],
      });

      const given = repo.getPerson('P1')?.names[0]?.parts?.find((part) => part.kind === 'given');
      expect(given?.id).toBe('NP1');
      expect(given?.value).toBe('Maria');
      expect(repo.listNotesFor('name_part', 'NP1').map((entry) => entry.id)).toEqual(['NT1']);
      expect(repo.listNotesFor('name_part', 'NP2')).toEqual([]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('keeps the flat-part id when only its spelling changes', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(
        person('P1', {
          names: [
            {
              id: 'N1',
              parts: [
                { id: 'NP1', kind: 'given', value: 'Alice', position: 0 },
                { id: 'NP2', kind: 'given', value: 'Beth', position: 1 },
              ],
            },
          ],
        }),
      );
      service.addNote(note('NT1', 'name_part', 'NP1'));

      const before = repo.getPerson('P1')!;
      service.updatePerson(before, {
        ...before,
        names: [{ id: 'N1', prefix: 'Dr', given: 'Alicia' }],
      });

      const given = repo.getPerson('P1')?.names[0]?.parts?.find((part) => part.kind === 'given');
      expect(given).toMatchObject({ id: 'NP1', value: 'Alicia' });
      expect(repo.listNotesFor('name_part', 'NP1').map((entry) => entry.id)).toEqual(['NT1']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('restores a participant in another fact and a name-part attachment on undo', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(
        person('P1', {
          names: [
            {
              id: 'N1',
              parts: [
                { id: 'NP1', kind: 'given', value: 'Ivan', position: 0 },
                { id: 'NP2', kind: 'surname', value: 'Petrov', position: 1 },
              ],
            },
          ],
          facts: [
            {
              id: 'FACT1',
              personId: 'P1',
              tag: 'BIRT',
              participants: [{ id: 'PTOWN', personId: 'P1', role: 'subject', position: 0 }],
            },
          ],
        }),
      );
      service.addPerson(
        person('P2', {
          facts: [
            {
              id: 'FACT2',
              personId: 'P2',
              tag: 'MARR',
              participants: [{ id: 'PT1', personId: 'P1', role: 'witness', position: 0 }],
            },
          ],
        }),
      );
      service.addNote(note('N1', 'name_part', 'NP2'));

      service.deletePerson(repo.getPerson('P1')!);

      expect(repo.getPerson('P1')).toBeUndefined();
      expect(repo.listFactsForPerson('P2')[0]?.participants).toBeUndefined();
      expect(repo.listNotesFor('name_part', 'NP2')).toEqual([]);

      service.undo();

      expect(repo.getPerson('P1')?.names[0]?.parts?.map((part) => part.value)).toEqual(['Ivan', 'Petrov']);
      expect(repo.listFactsForPerson('P1')[0]?.participants?.[0]?.id).toBe('PTOWN');
      expect(repo.listFactsForPerson('P2')[0]?.participants?.[0]).toMatchObject({
        id: 'PT1',
        personId: 'P1',
        role: 'witness',
      });
      expect(repo.listNotesFor('name_part', 'NP2').map((entry) => entry.id)).toEqual(['N1']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('restores participants without reusing an occupied position', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1'));
      service.addPerson(person('P2'));
      service.addPerson(person('P3'));
      const owner = repo.getPerson('P2')!;
      service.updatePerson(owner, {
        ...owner,
        facts: [
          {
            id: 'F2',
            personId: 'P2',
            tag: 'EVEN',
            participants: [
              { id: 'PTA', personId: 'P1', position: 0 },
              { id: 'PTB', personId: 'P3', position: 1 },
            ],
          },
        ],
      });

      service.deletePerson(repo.getPerson('P1')!);
      const afterDelete = repo.getFact('F2')!;
      const survivor = afterDelete.participants![0]!;
      repo.updateFact({ ...afterDelete, participants: [{ ...survivor, position: 0 }] });

      service.undo();
      expect(repo.getFact('F2')?.participants?.map((participant) => participant.id)).toEqual(['PTA', 'PTB']);
      expect(repo.getFact('F2')?.participants?.map((participant) => participant.position)).toEqual([0, 1]);

      service.redo();
      expect(repo.getFact('F2')?.participants?.map((participant) => participant.id)).toEqual(['PTB']);
      service.undo();
      expect(repo.getFact('F2')?.participants?.map((participant) => participant.id)).toEqual(['PTA', 'PTB']);
      expect(repo.getFact('F2')?.participants?.map((participant) => participant.position)).toEqual([0, 1]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('skips a deleted child place and unrelated place references on undo', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPlace({ id: 'PL1', names: [{ id: 'PN1', kind: 'official', position: 0, value: 'Tula' }] });
      service.addPlace({ id: 'PL2', names: [{ id: 'PN2', kind: 'official', position: 0, value: 'Tula Oblast' }] });
      repo.updatePlace({
        ...repo.getPlace('PL2')!,
        hierarchy: [{ id: 'H1', parentId: 'PL1', type: 'poli' }],
      });
      service.addPerson(person('P1'));
      const owner = repo.getPerson('P1')!;
      repo.updatePerson({
        ...owner,
        facts: [{ id: 'F1', personId: 'P1', tag: 'EVEN', placeId: 'PL2', additionalPlaceIds: ['PL1'] }],
      });

      service.deletePlace(repo.getPlace('PL1')!);
      repo.deletePlace('PL2');
      service.undo();

      expect(repo.getPlace('PL1')).toBeDefined();
      expect(repo.getPlace('PL2')).toBeUndefined();
      expect(repo.getFact('F1')?.placeId).toBeUndefined();
      expect(repo.getFact('F1')?.additionalPlaceIds).toEqual(['PL1']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('does not overwrite a conflicting hierarchy date on place undo', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPlace({ id: 'PL1', names: [{ id: 'PN1', kind: 'official', position: 0, value: 'Tula' }] });
      service.addPlace({ id: 'PL2', names: [{ id: 'PN2', kind: 'official', position: 0, value: 'Moscow' }] });
      service.addPlace({ id: 'PC', names: [{ id: 'PNC', kind: 'official', position: 0, value: 'District' }] });
      repo.updatePlace({
        ...repo.getPlace('PC')!,
        hierarchy: [{ id: 'H1', parentId: 'PL1', type: 'poli', date: { quality: 'exact', component: { year: 1800 } } }],
      });

      service.deletePlace(repo.getPlace('PL1')!);
      repo.updatePlace({
        ...repo.getPlace('PC')!,
        hierarchy: [{ id: 'H1', parentId: 'PL2', type: 'poli', date: { quality: 'exact', component: { year: 2000 } } }],
      });
      service.undo();

      expect(repo.getPlace('PC')?.hierarchy?.[0]).toMatchObject({
        id: 'H1',
        parentId: 'PL2',
        date: { component: { year: 2000 } },
      });
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('preserves later fact edits when redoing a place deletion', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPlace({ id: 'PL1', names: [{ id: 'PN1', kind: 'official', position: 0, value: 'Tula' }] });
      service.addPerson(person('P1'));
      const p1 = repo.getPerson('P1')!;
      repo.updatePerson({ ...p1, facts: [{ id: 'F1', personId: 'P1', tag: 'EVEN', placeId: 'PL1' }] });

      service.deletePlace(repo.getPlace('PL1')!);
      repo.updateFact({ ...repo.getFact('F1')!, value: 'edited later' });
      service.undo();
      expect(repo.getFact('F1')).toMatchObject({ value: 'edited later', placeId: 'PL1' });

      service.redo();
      expect(repo.getFact('F1')).toMatchObject({ value: 'edited later', placeId: undefined });
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('merges a stale person edit without dropping externally added facts', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1'));
      const stale = repo.getPerson('P1')!;
      repo.updatePerson({
        ...stale,
        facts: [{ id: 'RES1', personId: 'P1', tag: 'RESI', value: 'Moscow' }],
      });

      service.updatePerson(stale, { ...stale, sex: 'F' });

      expect(repo.getPerson('P1')?.sex).toBe('F');
      expect(repo.getPerson('P1')?.facts.map((fact) => fact.id)).toContain('RES1');
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('merges changed fact fields onto concurrent edits and omits deleted rows', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1'));
      const base = repo.getPerson('P1')!;
      repo.updatePerson({
        ...base,
        facts: [
          {
            id: 'B1',
            personId: 'P1',
            tag: 'BIRT',
            date: { quality: 'exact', component: { year: 1900 } },
            place: 'Old place',
          },
          { id: 'RES1', personId: 'P1', tag: 'RESI', value: 'Moscow' },
        ],
      });
      const before = repo.getPerson('P1')!;
      const current = repo.getPerson('P1')!;
      repo.updatePerson({
        ...current,
        facts: [
          {
            ...current.facts[0]!,
            place: 'New place',
          },
        ],
      });

      service.updatePerson(before, {
        ...before,
        facts: [
          {
            id: 'B1',
            personId: 'P1',
            tag: 'BIRT',
            date: { quality: 'exact', component: { year: 1901 } },
            place: 'Old place',
          },
          { id: 'RES1', personId: 'P1', tag: 'RESI', value: 'Moscow' },
        ],
      });

      const birth = repo.getPerson('P1')?.facts.find((fact) => fact.tag === 'BIRT');
      expect(birth?.date).toMatchObject({ component: { year: 1901 } });
      expect(birth?.place).toBe('New place');
      expect(repo.getPerson('P1')?.facts.some((fact) => fact.id === 'RES1')).toBe(false);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('restores externally added family statuses and their notes on undo', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addFamily({ id: 'F1', partners: [], children: [] });
      const stale = repo.getFamily('F1')!;
      repo.updateFamily({
        ...stale,
        marriageStatuses: [{ id: 'MS2', status: 'married' }],
      });
      repo.insertNote({
        id: 'N2',
        text: 'late status note',
        targetType: 'family_marriage_status',
        targetId: 'MS2',
      });

      service.updateFamily(stale, { ...stale, marriageStatuses: [] });
      expect(repo.listNotesFor('family_marriage_status', 'MS2')).toEqual([]);

      service.undo();
      expect(repo.getFamily('F1')?.marriageStatuses?.map((status) => status.id)).toEqual(['MS2']);
      expect(repo.listNotesFor('family_marriage_status', 'MS2').map((entry) => entry.id)).toEqual(['N2']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('restores externally added place names and their notes on undo', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPlace({ id: 'PL1', names: [{ id: 'PN1', kind: 'official', position: 0, value: 'Tula' }] });
      const stale = repo.getPlace('PL1')!;
      repo.updatePlace({
        ...stale,
        names: [...stale.names, { id: 'PN2', kind: 'official', position: 1, value: 'Tula Oblast' }],
      });
      repo.insertNote({
        id: 'N2',
        text: 'late name note',
        targetType: 'place_name',
        targetId: 'PN2',
      });

      service.updatePlace(stale, { ...stale, names: [stale.names[0]!] });
      expect(repo.listNotesFor('place_name', 'PN2')).toEqual([]);

      service.undo();
      expect(repo.getPlace('PL1')?.names.map((name) => name.id)).toEqual(['PN1', 'PN2']);
      expect(repo.listNotesFor('place_name', 'PN2').map((entry) => entry.id)).toEqual(['N2']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('skips a family association whose other person disappeared before undo', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1'));
      service.addPerson(person('P2'));
      service.addFamily({ id: 'F1', partners: ['P1'], children: [] });
      service.addAssociation({ id: 'A1', familyId: 'F1', otherPersonId: 'P2', role: 'witness' });
      service.addNote(note('N1', 'association', 'A1'));

      service.deleteFamily(repo.getFamily('F1')!);
      repo.deletePerson('P2');
      service.undo();

      expect(repo.getFamily('F1')).toBeDefined();
      expect(repo.listAssociationsForFamily('F1')).toEqual([]);
      expect(repo.listNotesFor('association', 'A1')).toEqual([]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('skips a participant whose fact disappeared before undo', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1'));
      service.addPerson(person('P2'));
      const p2 = repo.getPerson('P2')!;
      service.updatePerson(p2, {
        ...p2,
        facts: [
          {
            id: 'F2',
            personId: 'P2',
            tag: 'EVEN',
            participants: [{ id: 'PT1', personId: 'P1', position: 0 }],
          },
        ],
      });

      service.deletePerson(repo.getPerson('P1')!);
      repo.deleteFact('F2');
      service.undo();

      expect(repo.getPerson('P1')).toBeDefined();
      expect(repo.getFact('F2')).toBeUndefined();
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('keeps a later media file when undoing a place deletion', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPlace({ id: 'PL1', names: [{ id: 'PN1', kind: 'official', position: 0, value: 'Tula' }] });
      service.addMedia({
        id: 'M1',
        placeId: 'PL1',
        files: [{ id: 'MF1', path: 'media/a.jpg' }],
      });
      service.deletePlace(repo.getPlace('PL1')!);

      const media = repo.getMedia('M1')!;
      repo.updateMedia({ ...media, files: [...(media.files ?? []), { id: 'MF2', path: 'media/b.jpg' }] });
      service.undo();

      expect(repo.getMedia('M1')?.placeId).toBe('PL1');
      expect(repo.getMedia('M1')?.files?.map((file) => file.id)).toEqual(['MF1', 'MF2']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('does not overwrite a later assignment when undoing an address or repository deletion', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1'));
      service.addAddress({ id: 'AD1', city: 'Tula', lines: [] });
      const p1 = repo.getPerson('P1')!;
      service.updatePerson(p1, { ...p1, addressId: 'AD1' });
      service.deleteAddress(repo.getAddress('AD1')!);
      repo.insertAddress({ id: 'A2', city: 'Moscow', lines: [] });
      repo.setPersonAddressId('P1', 'A2');
      service.undo();
      expect(repo.getPerson('P1')?.addressId).toBe('A2');

      service.addRepository({ id: 'RP1', name: 'Archive' });
      service.addTask({ id: 'TD1', text: 'Task', repositoryId: 'RP1' });
      service.deleteRepository(repo.getRepository('RP1')!);
      repo.insertRepository({ id: 'RP2', name: 'Other archive' });
      repo.setTaskRepositoryId('TD1', 'RP2');
      service.undo();
      expect(repo.getTask('TD1')?.repositoryId).toBe('RP2');
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('uses the persisted person for the delete and undo snapshot', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1'));
      service.addFamily({ id: 'F1', partners: ['P1'], children: [] });
      service.addFamily({ id: 'F2', partners: ['P1'], children: [] });
      const stale = repo.getPerson('P1')!;
      const current = repo.getPerson('P1')!;
      repo.updatePerson({
        ...current,
        names: [{ id: 'N2', given: 'Augusta' }],
        facts: [
          {
            id: 'ADOP1',
            personId: 'P1',
            tag: 'ADOP',
            familyLinks: [
              { id: 'FF1', familyId: 'F1', position: 0 },
              { id: 'FF2', familyId: 'F2', position: 1 },
            ],
          },
        ],
      });

      service.deletePerson(stale);
      service.undo();

      expect(repo.getPerson('P1')?.names[0]?.id).toBe('N2');
      expect(repo.getPerson('P1')?.facts[0]?.familyLinks?.map((link) => link.id)).toEqual(['FF1', 'FF2']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('keeps concurrent ids when an optional link collection was absent', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1'));
      service.addFamily({ id: 'F1', partners: ['P1'], children: [] });
      service.addFamily({ id: 'F2', partners: ['P1'], children: [] });
      service.addFact({ id: 'ADOP1', personId: 'P1', tag: 'ADOP' });
      const before = repo.getPerson('P1')!;
      expect(before.facts[0]?.familyLinks).toBeUndefined();

      repo.updateFact({
        ...before.facts[0]!,
        familyLinks: [{ id: 'FL1', familyId: 'F1', position: 0 }],
      });
      service.updatePerson(before, {
        ...before,
        facts: [{ ...before.facts[0]!, familyLinks: [{ id: 'FL2', familyId: 'F2', position: 0 }] }],
      });

      const links = repo.getPerson('P1')?.facts[0]?.familyLinks ?? [];
      expect(links.map((link) => link.id).sort()).toEqual(['FL1', 'FL2']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('clears only baseline links when a draft removes its last family link', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1'));
      service.addFamily({ id: 'F1', partners: ['P1'], children: [] });
      service.addFamily({ id: 'F2', partners: ['P1'], children: [] });
      service.addFact({
        id: 'ADOP1',
        personId: 'P1',
        tag: 'ADOP',
        familyLinks: [{ id: 'FL1', familyId: 'F1', position: 0 }],
      });
      const before = repo.getPerson('P1')!;
      repo.updateFact({
        ...before.facts[0]!,
        familyLinks: [
          { id: 'FL1', familyId: 'F1', position: 0 },
          { id: 'FL2', familyId: 'F2', position: 1 },
        ],
      });

      // The draft removes FL1 and omits the field entirely.
      service.updatePerson(before, {
        ...before,
        facts: [{ ...before.facts[0]!, familyLinks: undefined }],
      });

      expect(repo.getPerson('P1')?.facts[0]?.familyLinks?.map((link) => link.id)).toEqual(['FL2']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('drops ownership links whose family disappeared before the undo', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1'));
      service.addFamily({ id: 'F1', partners: ['P1'], children: [] });
      service.addFamily({ id: 'F2', partners: ['P1'], children: [] });
      service.addFact({
        id: 'ADOP1',
        familyId: 'F1',
        tag: 'ADOP',
        familyLinks: [{ id: 'FF1', familyId: 'F2', position: 0 }],
      });

      service.deleteFamily(repo.getFamily('F1')!);
      // Another writer removes the linked family while F1 is deleted.
      repo.deleteFamily('F2');

      service.undo();
      expect(repo.getFamily('F1')).toBeDefined();
      const restored = repo.listFactsForFamily('F1')[0]!;
      expect(restored.id).toBe('ADOP1');
      expect(restored.familyLinks).toBeUndefined();
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('rejects redo when a dependency appeared after the undo', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1'));
      service.deletePerson(repo.getPerson('P1')!);
      service.undo();

      // A concurrent writer adds a family membership the captured inverse
      // could not restore if the redo deleted it.
      repo.insertFamily({ id: 'F2', partners: ['P1'], children: [] });
      const refused = service.redo();
      expect(refused.redoBlocked).toBe(true);
      expect(refused.canRedo).toBe(false);
      expect(repo.getPerson('P1')).toBeDefined();
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('restores a fact without a participant whose person vanished', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1'));
      service.addPerson(person('P2'));
      service.addFact({
        id: 'F1',
        personId: 'P1',
        tag: 'BIRT',
        participants: [{ id: 'PT1', personId: 'P2', position: 0 }],
      });
      service.deleteFact(repo.getFact('F1')!);
      repo.deletePerson('P2');

      service.undo();
      const restored = repo.getFact('F1')!;
      expect(restored.id).toBe('F1');
      expect(restored.participants?.[0]?.id).toBe('PT1');
      expect(restored.participants?.[0]?.personId).toBeUndefined();
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('rejects redoing a note delete after a new link appeared', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addNote(note('N1', 'person', 'P1'));
      service.deleteNote(repo.getNote('N1')!);
      service.undo();

      repo.addNoteLink('N1', { id: 'L2', targetType: 'person', targetId: 'P2' });
      const refused = service.redo();
      expect(refused.redoBlocked).toBe(true);
      expect(refused.canRedo).toBe(false);
      expect(repo.getNote('N1')).toBeDefined();
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('restores a task without a repository that vanished', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addRepository({ id: 'R1', name: 'Archive' });
      service.addTask({ id: 'T1', text: 'Task', repositoryId: 'R1' });
      service.deleteTask(repo.getTask('T1')!);
      repo.deleteRepository('R1');

      service.undo();
      const restored = repo.getTask('T1')!;
      expect(restored.text).toBe('Task');
      expect(restored.repositoryId).toBeUndefined();
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('restores a source event without a place that vanished', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPlace({ id: 'PL1', names: [{ id: 'PN1', kind: 'official', position: 0, value: 'Moscow' }] });
      service.addSource({
        id: 'S1',
        title: 'Book',
        dataEvents: [{ id: 'SE1', tag: 'DATA', placeId: 'PL1' }],
      });
      service.deleteSource(repo.getSource('S1')!);
      repo.deletePlace('PL1');

      service.undo();
      const restored = repo.getSource('S1')!;
      expect(restored.title).toBe('Book');
      expect(restored.dataEvents?.[0]?.id).toBe('SE1');
      expect(restored.dataEvents?.[0]?.placeId).toBeUndefined();
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('does not add an undo entry for an alias that was not created', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1'));
      expect(() => service.addAlias('P1', 'missing')).toThrow(/cannot add alias/);
      expect(repo.listAliasesFor('P1')).toEqual([]);

      service.undo();
      expect(repo.getPerson('P1')).toBeUndefined();
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('rejects family, person, media and repository redo when attachments appeared', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1'));
      service.addFamily({ id: 'F1', partners: ['P1'], children: [] });
      service.deleteFamily(repo.getFamily('F1')!);
      service.undo();
      repo.insertNote({ id: 'NF', text: 'family note', targetType: 'family', targetId: 'F1' });
      expect(service.redo().redoBlocked).toBe(true);
      expect(repo.getFamily('F1')).toBeDefined();

      service.deletePerson(repo.getPerson('P1')!);
      service.undo();
      repo.insertNote({ id: 'NP', text: 'person note', targetType: 'person', targetId: 'P1' });
      expect(service.redo().redoBlocked).toBe(true);
      expect(repo.getPerson('P1')).toBeDefined();

      service.addMedia({ id: 'M1', title: 'Photo', targetType: 'person', targetId: 'P1' });
      service.deleteMedia(repo.getMedia('M1')!);
      service.undo();
      repo.insertNote({ id: 'NM', text: 'media note', targetType: 'media', targetId: 'M1' });
      expect(service.redo().redoBlocked).toBe(true);
      expect(repo.getMedia('M1')).toBeDefined();

      service.addRepository({ id: 'R1', name: 'Archive' });
      service.deleteRepository(repo.getRepository('R1')!);
      service.undo();
      repo.insertNote({ id: 'NR', text: 'repository note', targetType: 'repository', targetId: 'R1' });
      expect(service.redo().redoBlocked).toBe(true);
      expect(repo.getRepository('R1')).toBeDefined();
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('checks family link, fact and association attachments before redo', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1'));
      service.addFamily({ id: 'F1', partners: ['P1'], children: [] });
      service.deleteFamily(repo.getFamily('F1')!);
      service.undo();
      const partnerId = repo.getFamily('F1')!.partnerLinks![0]!.id;
      repo.insertNote({ id: 'NL', text: 'link note', targetType: 'family_partner', targetId: partnerId });
      expect(service.redo().redoBlocked).toBe(true);

      service.addFamily({ id: 'F2', partners: ['P1'], children: [] });
      service.addFact({ id: 'FM1', familyId: 'F2', tag: 'MARR' });
      service.deleteFamily(repo.getFamily('F2')!);
      service.undo();
      repo.insertNote({ id: 'NF', text: 'fact note', targetType: 'fact', targetId: 'FM1' });
      expect(service.redo().redoBlocked).toBe(true);

      service.addFamily({ id: 'F3', partners: ['P1'], children: [] });
      service.addAssociation({ id: 'A1', familyId: 'F3', otherPersonId: 'P1', role: 'witness' });
      service.deleteFamily(repo.getFamily('F3')!);
      service.undo();
      repo.insertNote({ id: 'NA', text: 'association note', targetType: 'association', targetId: 'A1' });
      expect(service.redo().redoBlocked).toBe(true);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('rejects person redo after another writer changed the aggregate', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1', { sex: 'U' }));
      const before = repo.getPerson('P1')!;
      service.updatePerson(before, { ...before, sex: 'F' });
      service.undo();

      repo.updatePerson({
        ...repo.getPerson('P1')!,
        facts: [{ id: 'RES1', personId: 'P1', tag: 'RESI', value: 'Moscow' }],
      });
      const refused = service.redo();
      expect(refused.redoBlocked).toBe(true);
      expect(repo.getPerson('P1')?.sex).toBe('U');
      expect(repo.getPerson('P1')?.facts.map((fact) => fact.id)).toEqual(['RES1']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('preserves child-link evidence when the flat child list changes', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1'));
      service.addPerson(person('P2'));
      service.addPerson(person('P3'));
      service.addFamily({
        id: 'F1',
        partners: ['P1'],
        children: ['P2'],
        childLinks: [{ id: 'FC1', childId: 'P2', status: 'challenged', statusPhrase: 'maybe' }],
      });
      const before = repo.getFamily('F1')!;
      service.updateFamily(before, { ...before, children: ['P2', 'P3'] });

      const links = repo.getFamily('F1')?.childLinks ?? [];
      expect(links.find((link) => link.childId === 'P2')).toMatchObject({
        id: 'FC1',
        status: 'challenged',
        statusPhrase: 'maybe',
      });
      expect(links.some((link) => link.childId === 'P3')).toBe(true);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('keeps concurrent additional places when the draft extends the list', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1'));
      for (const id of ['A', 'B', 'C']) {
        service.addPlace({ id, names: [{ id: `PN-${id}`, kind: 'official', position: 0, value: id }] });
      }
      service.addFact({ id: 'F1', personId: 'P1', tag: 'BIRT', additionalPlaceIds: ['A'] });
      const before = repo.getPerson('P1')!;
      repo.updateFact({ ...before.facts[0]!, additionalPlaceIds: ['A', 'C'] });

      service.updatePerson(before, {
        ...before,
        facts: [{ ...before.facts[0]!, additionalPlaceIds: ['A', 'B'] }],
      });
      expect(repo.getPerson('P1')?.facts[0]?.additionalPlaceIds).toEqual(['A', 'B', 'C']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('preserves repeated additional-place occurrences when appending', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson({ id: 'P1', names: [], sex: 'U', facts: [] });
      for (const id of ['A', 'B']) {
        service.addPlace({ id, names: [{ id: `PN-${id}`, kind: 'official', position: 0, value: id }] });
      }
      service.addFact({ id: 'F1', personId: 'P1', tag: 'BIRT', additionalPlaceIds: ['A', 'A'] });
      const before = repo.getPerson('P1')!;
      service.updatePerson(before, {
        ...before,
        facts: [{ ...before.facts[0]!, additionalPlaceIds: ['A', 'A', 'B'] }],
      });
      expect(repo.getPerson('P1')?.facts[0]?.additionalPlaceIds).toEqual(['A', 'A', 'B']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('remaps an adoption slot when family partners are reordered', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1'));
      service.addPerson(person('P2'));
      service.addPerson(person('C'));
      service.addFamily({ id: 'F1', partners: ['P1', 'P2'], children: ['C'] });
      service.addFact({
        id: 'ADOP1',
        personId: 'C',
        tag: 'ADOP',
        familyLinks: [{ id: 'FF1', familyId: 'F1', adoptedBy: 'HUSB', position: 0 }],
      });
      const before = repo.getFamily('F1')!;
      service.updateFamily(before, { ...before, partners: ['P2', 'P1'] });
      expect(repo.getPerson('C')?.facts[0]?.familyLinks?.[0]?.adoptedBy).toBe('WIFE');
      service.undo();
      expect(repo.getPerson('C')?.facts[0]?.familyLinks?.[0]?.adoptedBy).toBe('HUSB');
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('keeps a concurrent name reorder when the draft order is unchanged', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson({
        id: 'P1',
        sex: 'U',
        names: [
          { id: 'N1', given: 'Anna' },
          { id: 'N2', given: 'Maria' },
        ],
        facts: [],
      });
      const before = repo.getPerson('P1')!;
      repo.updatePerson({ ...before, names: [before.names[1]!, before.names[0]!] });
      service.updatePerson(before, { ...before, sex: 'F' });
      expect(repo.getPerson('P1')?.names.map((name) => name.id)).toEqual(['N2', 'N1']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('keeps inserted names at their requested position', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson({
        id: 'P1',
        sex: 'U',
        names: [
          { id: 'N1', given: 'Anna' },
          { id: 'N2', given: 'Maria' },
        ],
        facts: [],
      });
      const before = repo.getPerson('P1')!;
      service.updatePerson(before, { ...before, names: [{ id: 'N3', given: 'New' }, ...before.names] });
      expect(repo.getPerson('P1')?.names.map((name) => name.id)).toEqual(['N3', 'N1', 'N2']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('keeps a concurrent additional-place reorder when the draft appends', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson({ id: 'P1', names: [], sex: 'U', facts: [] });
      for (const id of ['A', 'B', 'C']) {
        service.addPlace({ id, names: [{ id: `PN-${id}`, kind: 'official', position: 0, value: id }] });
      }
      service.addFact({ id: 'F1', personId: 'P1', tag: 'BIRT', additionalPlaceIds: ['A', 'B'] });
      const before = repo.getPerson('P1')!;
      repo.updateFact({ ...before.facts[0]!, additionalPlaceIds: ['B', 'A'] });
      service.updatePerson(before, {
        ...before,
        facts: [{ ...before.facts[0]!, additionalPlaceIds: ['A', 'B', 'C'] }],
      });
      expect(repo.getPerson('P1')?.facts[0]?.additionalPlaceIds).toEqual(['B', 'A', 'C']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('reactivates a newly selected disproven child link', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1'));
      service.addPerson(person('P2'));
      service.addFamily({
        id: 'F1',
        partners: ['P1'],
        children: [],
        childLinks: [{ id: 'FC1', childId: 'P2', status: 'disproven', statusPhrase: 'no' }],
      });
      const before = repo.getFamily('F1')!;
      service.updateFamily(before, { ...before, children: ['P2'] });
      expect(repo.getFamily('F1')?.childLinks?.[0]).toMatchObject({ id: 'FC1' });
      expect(repo.getFamily('F1')?.childLinks?.[0]?.status).toBeUndefined();
      expect(repo.getFamily('F1')?.childLinks?.[0]?.statusPhrase).toBeUndefined();
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('preserves concurrent family members when the draft changes the flat list', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1'));
      service.addPerson(person('P2'));
      service.addPerson(person('P3'));
      service.addFamily({ id: 'F1', partners: ['P1'], children: [] });
      const before = repo.getFamily('F1')!;
      const current = repo.getFamily('F1')!;
      repo.updateFamily({
        ...current,
        partners: ['P1', 'P2'],
        partnerLinks: [...(current.partnerLinks ?? []), { id: 'FL2', personId: 'P2' }],
      });
      service.updateFamily(before, { ...before, partners: ['P1', 'P3'] });

      const partners = repo.getFamily('F1')!.partnerLinks?.map((link) => link.personId) ?? [];
      expect(partners).toEqual(expect.arrayContaining(['P1', 'P2', 'P3']));
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('keeps concurrent additional-place removals when the draft did not edit the list', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1'));
      service.addPlace({ id: 'A', names: [{ id: 'PNA', kind: 'official', position: 0, value: 'A' }] });
      service.addPlace({ id: 'C', names: [{ id: 'PNC', kind: 'official', position: 0, value: 'C' }] });
      service.addFact({ id: 'F1', personId: 'P1', tag: 'BIRT', value: 'draft', additionalPlaceIds: ['A'] });
      const before = repo.getPerson('P1')!;
      repo.updateFact({ ...before.facts[0]!, additionalPlaceIds: ['C'] });

      service.updatePerson(before, {
        ...before,
        facts: [{ ...before.facts[0]!, value: 'edited' }],
      });
      expect(repo.getPerson('P1')?.facts[0]?.additionalPlaceIds).toEqual(['C']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('drops a stale undo entry but keeps older history reachable', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addNote(note('N1', 'person', 'P1'));
      service.addPerson(person('P2'));
      service.updateNote(repo.getNote('N1')!, { ...repo.getNote('N1')!, text: 'edited' });
      repo.deleteNote('N1');

      const blocked = service.undo();
      expect(blocked.undoBlocked).toBe(true);
      expect(service.undo().canUndo).toBe(true);
      expect(repo.getPerson('P2')).toBeUndefined();
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('does not leave a change-log row when a stale update fails', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson(person('P1'));
      expect(() =>
        service.updateFact({ id: 'F404', personId: 'P1', tag: 'BIRT' }, { id: 'F404', personId: 'P1', tag: 'DEAT' }),
      ).toThrow(/no longer exists/);
      expect(repo.listChangesFor('fact', 'F404')).toEqual([]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('uses the persisted source for the delete and undo snapshot', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      const source: SourceRecord = { id: 'S1', title: 'Old title' };
      service.addSource(source);
      const stale = repo.getSource('S1')!;
      repo.updateSource({ ...stale, title: 'New title' });

      service.deleteSource(stale);
      service.undo();

      expect(repo.getSource('S1')?.title).toBe('New title');
    } finally {
      cleanupRepo(fixture);
    }
  });
});
