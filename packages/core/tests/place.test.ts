import { describe, expect, it } from 'vitest';
import type { PlaceRecord } from '../src/model/types';
import { placeName } from '../src/model/types';
import { cleanupRepo, makeRepo } from './helpers';

const moscow: PlaceRecord = {
  id: 'PL1',
  latitude: 55.7558,
  longitude: 37.6173,
  names: [
    { id: 'PN1', kind: 'official', position: 0, value: 'Moscow' },
    { id: 'PN2', kind: 'official', position: 1, value: 'Russia' },
  ],
};

describe('placeName', () => {
  it('joins the official names smallest-first and skips empty values', () => {
    expect(placeName(undefined)).toBe('');
    expect(placeName({ id: 'P1', names: [] })).toBe('');
    const place: PlaceRecord = {
      id: 'P1',
      names: [
        { id: 'N2', kind: 'official', position: 1, value: 'Russia' },
        { id: 'N1', kind: 'official', position: 0, value: 'Moscow' },
        { id: 'N3', kind: 'translation', position: 0, value: 'Москва' },
        { id: 'N4', kind: 'official', position: 2, value: '' },
      ],
    };
    expect(placeName(place)).toBe('Moscow, Russia');
  });
});

describe('PlaceRepo', () => {
  it('round-trips places with hierarchical names', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertPlace(moscow);

      const read = repo.getPlace('PL1');
      expect(read).toEqual({
        id: 'PL1',
        latitude: 55.7558,
        longitude: 37.6173,
        names: [
          { id: 'PN1', kind: 'official', position: 0, value: 'Moscow' },
          { id: 'PN2', kind: 'official', position: 1, value: 'Russia' },
        ],
      });

      repo.updatePlace({
        ...moscow,
        verified: true,
        names: [
          { id: 'PN1', kind: 'official', position: 0, value: 'Москва' },
          { id: 'PN2', kind: 'official', position: 1, value: 'Россия' },
          { id: 'PN3', kind: 'translation', language: 'en', position: 0, value: 'Moscow' },
        ],
      });
      const updated = repo.getPlace('PL1')!;
      expect(updated.verified).toBe(true);
      expect(updated.names.map((name) => name.value)).toEqual(['Москва', 'Россия', 'Moscow']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('searches places by name in any case', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertPlace(moscow);
      repo.insertPlace({
        id: 'PL2',
        names: [{ id: 'PN3', kind: 'official', position: 0, value: 'Берлин' }],
      });

      expect(repo.searchPlaces('moscow').map((place) => place.id)).toEqual(['PL1']);
      expect(repo.searchPlaces('MOSCOW').map((place) => place.id)).toEqual(['PL1']);
      expect(repo.searchPlaces('берл').map((place) => place.id)).toEqual(['PL2']);
      // Short terms fall back to a scan.
      expect(repo.searchPlaces('mo').map((place) => place.id)).toEqual(['PL1']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('detaches facts when the place is deleted, keeping the raw text', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertPlace(moscow);
      repo.insertPerson({
        id: 'P1',
        sex: 'U',
        names: [{ id: 'N1', given: 'Ivan', surname: 'Ivanov' }],
        facts: [
          { id: 'F1', personId: 'P1', tag: 'BIRT', date: { quality: 'exact', component: { year: 1923 } }, placeId: 'PL1', place: 'Moscow, Russia' },
        ],
      });

      expect(repo.deletePlace('PL1')).toBe(true);
      const facts = repo.listFactsForPerson('P1');
      expect(facts[0]?.placeId).toBeUndefined();
      expect(facts[0]?.place).toBe('Moscow, Russia');
    } finally {
      cleanupRepo(fixture);
    }
  });
});
