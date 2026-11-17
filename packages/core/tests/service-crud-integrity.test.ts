import { describe, expect, it } from 'vitest';
import type {
  AddressRecord,
  FamilyRecord,
  NoteRecord,
  PersonRecord,
  PlaceRecord,
  RepositoryRecord,
  SourceRecord,
  TodoRecord,
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
      service.deletePlace(stored);

      expect(repo.getPlace('PL1')).toBeUndefined();
      expect(repo.listFactsForPerson('P1').find((fact) => fact.id === 'FACT1')?.placeId).toBeUndefined();
      expect(repo.listFactsForPerson('P1').find((fact) => fact.id === 'FACT2')?.additionalPlaceIds).toEqual(['PL3']);
      expect(repo.getFamily('F1')?.marriageStatuses?.[0]?.placeId).toBeUndefined();
      expect(repo.getSource('S1')?.dataEvents?.[0]?.placeId).toBeUndefined();
      expect(repo.getMedia('M1')?.placeId).toBeUndefined();
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

  it('restores todo and title repository links on undo', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      const repository: RepositoryRecord = { id: 'RP1', name: 'State Archive' };
      const todo: TodoRecord = { id: 'T1', text: 'Order the record', repositoryId: 'RP1' };
      const title: TitleRecord = { id: 'TL1', name: 'The Parish Registers', repositoryId: 'RP1' };
      service.addRepository(repository);
      service.addTodo(todo);
      service.addTitle(title);

      service.deleteRepository(repository);

      expect(repo.listTodos().find((entry) => entry.id === 'T1')?.repositoryId).toBeUndefined();
      expect(repo.listTitles().find((entry) => entry.id === 'TL1')?.repositoryId).toBeUndefined();

      service.undo();

      expect(repo.listTodos().find((entry) => entry.id === 'T1')?.repositoryId).toBe('RP1');
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
});
