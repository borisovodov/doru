import { describe, expect, it } from 'vitest';
import { cleanupRepo, makeRepo } from './helpers';

describe('schema v3 extra structures', () => {
  it('round-trips person addresses, name vendor fields and family metadata', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertAddress({ id: 'A1', lines: [{ id: 'AL1', value: '1 Main Street' }], city: 'Tula' });
      repo.insertPerson({
        id: 'P1',
        sex: 'F',
        addressId: 'A1',
        names: [
          {
            id: 'N1',
            given: 'Anna',
            surname: 'Petrova',
            variantType: 'pinyin',
            callName: 'Anya',
            middleName: 'Maria',
            patronymic: 'Ivanovna',
            marriedName: 'Sidorova',
            aka: 'Annette',
            hebrewName: 'Chana',
            title: 'Dr',
            shortName: 'A. Petrova',
            nameAsRecorded: 'Anna Petrova',
            givenNameUsed: 'Anya',
          },
        ],
        facts: [],
      });
      repo.insertFamily({
        id: 'F1',
        preferred: true,
        sameSex: true,
        unionKind: 'marriage',
        unionStatus: 'married',
        marriageBeginStatus: 'engaged',
        marriageEndStatus: 'widowed',
        witnesses: ['Ivan', 'Maria'],
        marriageStatuses: [
          { id: 'MS1', status: 'married', date: { quality: 'exact', component: { year: 1900 } }, placeId: undefined },
        ],
        partners: ['P1'],
        children: [],
        partnerLinks: [
          {
            id: 'PL1',
            personId: 'P1',
            preferred: true,
            phrase: 'the elder',
            name: 'Anna Petrova',
            civilStatus: 'widowed',
            marriageNumber: '2',
          },
        ],
      });

      expect(repo.getPerson('P1')?.addressId).toBe('A1');
      expect(repo.getPerson('P1')?.names[0]).toMatchObject({
        variantType: 'pinyin',
        callName: 'Anya',
        middleName: 'Maria',
        patronymic: 'Ivanovna',
        marriedName: 'Sidorova',
        aka: 'Annette',
        hebrewName: 'Chana',
        title: 'Dr',
        shortName: 'A. Petrova',
        nameAsRecorded: 'Anna Petrova',
        givenNameUsed: 'Anya',
      });
      expect(repo.getFamily('F1')).toMatchObject({
        preferred: true,
        sameSex: true,
        unionKind: 'marriage',
        unionStatus: 'married',
        marriageBeginStatus: 'engaged',
        marriageEndStatus: 'widowed',
        witnesses: ['Ivan', 'Maria'],
      });
      expect(repo.getFamily('F1')?.partnerLinks?.[0]).toMatchObject({
        phrase: 'the elder',
        name: 'Anna Petrova',
        civilStatus: 'widowed',
        marriageNumber: '2',
        preferred: true,
      });
      expect(repo.getFamily('F1')?.marriageStatuses?.[0]).toMatchObject({
        id: 'MS1',
        status: 'married',
        date: expect.objectContaining({ component: { year: 1900 } }),
      });

      repo.insertAssociation({ id: 'AF1', familyId: 'F1', otherPersonId: 'P1', role: 'witness' });
      expect(repo.listAssociationsForFamily('F1')).toEqual([
        expect.objectContaining({ id: 'AF1', familyId: 'F1', otherPersonId: 'P1', role: 'witness' }),
      ]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('round-trips place details, fact periods/extra places and source citations', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertPlace({ id: 'PL2', names: [{ id: 'PN2', kind: 'official', position: 0, value: 'Russia' }] });
      repo.insertPlace({
        id: 'PL1',
        form: ['city', 'region', 'country'],
        abbreviation: 'TUL',
        preposition: 'in',
        maidenhead: 'KO91',
        placeType: 'city',
        names: [
          {
            id: 'PN1',
            kind: 'official',
            position: 0,
            value: 'Tula',
            addition: 'Tula Oblast',
            abbreviation: 'Tul.',
            abbreviationType: 'ISO',
            date: { quality: 'exact', component: { year: 1800 } },
          },
        ],
        hierarchy: [{ id: 'PH1', parentId: 'PL2', type: 'poli' }],
      });

      repo.insertPerson({ id: 'P1', sex: 'U', names: [], facts: [] });
      repo.insertFact({
        id: 'E1',
        personId: 'P1',
        tag: 'RESI',
        date: { quality: 'range', component: { year: 1910 }, end: { year: 1920 } },
        additionalPlaceIds: ['PL2'],
        placePrefix: 'near',
        eventNumber: '7',
        birthLength: '52 cm',
        birthWeight: '3.4 kg',
        cemetery: 'Central',
        fna: true,
        descriptionAware: true,
        map: { latitude: 54.19, longitude: 37.61 },
      });
      repo.insertSource({
        id: 'S1',
        title: 'Register',
        certainty: '3',
        subsequentCitationFormat: 'Register, 1900',
        bibliography: 'Register. 1900.',
        dataNote: 'A note',
      });
      repo.insertCitation({
        id: 'C1',
        sourceId: 'S1',
        targetType: 'person',
        targetId: 'P1',
        name: 'citation name',
        qualityAssessment: 'high',
        reference: 'CREF-1',
        abbreviation: 'Reg.',
        footnote: 'see register',
        verified: true,
        assessment: 'consistent',
        foundBy: 'me',
      });

      expect(repo.getPlace('PL1')).toMatchObject({
        form: ['city', 'region', 'country'],
        abbreviation: 'TUL',
        preposition: 'in',
        maidenhead: 'KO91',
        placeType: 'city',
      });
      expect(repo.getPlace('PL1')?.names[0]).toMatchObject({
        addition: 'Tula Oblast',
        abbreviation: 'Tul.',
        abbreviationType: 'ISO',
        date: expect.objectContaining({ component: { year: 1800 } }),
      });
      expect(repo.getPlace('PL1')?.hierarchy?.[0]).toMatchObject({ id: 'PH1', parentId: 'PL2', type: 'poli' });
      expect(repo.getPerson('P1')?.facts[0]).toMatchObject({
        date: expect.objectContaining({ quality: 'range', end: { year: 1920 } }),
        additionalPlaceIds: ['PL2'],
        placePrefix: 'near',
        eventNumber: '7',
        birthLength: '52 cm',
        birthWeight: '3.4 kg',
        cemetery: 'Central',
        fna: true,
        descriptionAware: true,
        map: { latitude: 54.19, longitude: 37.61 },
      });
      expect(repo.getSource('S1')).toMatchObject({
        certainty: '3',
        subsequentCitationFormat: 'Register, 1900',
        bibliography: 'Register. 1900.',
        dataNote: 'A note',
      });
      expect(repo.getCitation('C1')).toMatchObject({
        name: 'citation name',
        qualityAssessment: 'high',
        reference: 'CREF-1',
        abbreviation: 'Reg.',
        footnote: 'see register',
        verified: true,
        assessment: 'consistent',
        foundBy: 'me',
      });
    } finally {
      cleanupRepo(fixture);
    }
  });
});
