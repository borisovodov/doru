import { describe, expect, it } from 'vitest';
import type { PlaceRecord } from '../src/model/types';
import { addPlaceOp, deletePlaceOp, updatePlaceOp } from '../src/ops/place';
import { OpQueue } from '../src/ops/op';
import { TreeService } from '../src/service/tree';
import { cleanupRepo, makeRepo } from './helpers';

const moscow: PlaceRecord = {
  id: 'PL1',
  names: [{ id: 'PN1', kind: 'official', position: 0, value: 'Moscow' }],
};

function makeService() {
  const fixture = makeRepo();
  const service = new TreeService(fixture.repo, new OpQueue());
  return { fixture, service };
}

describe('place ops', () => {
  it('adds, updates and removes a place with direct ops', () => {
    const fixture = makeRepo();
    try {
      const ctx = { repo: fixture.repo };
      const add = addPlaceOp(moscow);
      add.apply(ctx);
      expect(fixture.repo.getPlace('PL1')).toEqual(moscow);

      const renamed: PlaceRecord = {
        ...moscow,
        verified: true,
        names: [{ id: 'PN1', kind: 'official', position: 0, value: 'Москва' }],
      };
      updatePlaceOp(moscow, renamed).apply(ctx);
      expect(fixture.repo.getPlace('PL1')?.verified).toBe(true);
      expect(fixture.repo.getPlace('PL1')?.names[0]?.value).toBe('Москва');

      updatePlaceOp(moscow, renamed).inverse(ctx);
      expect(fixture.repo.getPlace('PL1')?.names[0]?.value).toBe('Moscow');

      const del = deletePlaceOp(moscow, []);
      del.apply(ctx);
      expect(fixture.repo.getPlace('PL1')).toBeUndefined();
      del.inverse(ctx);
      expect(fixture.repo.getPlace('PL1')).toEqual(moscow);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('deleting a place restores the facts it was attached to on undo', () => {
    const fixture = makeRepo();
    try {
      const ctx = { repo: fixture.repo };
      const fact = {
        id: 'F1',
        personId: 'P1',
        tag: 'BIRT',
        date: { quality: 'exact' as const, component: { year: 1923 } },
        placeId: 'PL1',
        place: 'Moscow',
      };
      fixture.repo.insertPlace(moscow);
      fixture.repo.insertPerson({ id: 'P1', names: [], sex: 'U', facts: [fact] });

      const detach = deletePlaceOp(moscow, [
        { before: fact, after: { ...fact, placeId: undefined } },
      ]);
      detach.apply(ctx);
      expect(fixture.repo.listFactsForPlace('PL1')).toEqual([]);

      detach.inverse(ctx);
      expect(fixture.repo.getPlace('PL1')).toEqual(moscow);
      expect(fixture.repo.listFactsForPerson('P1')[0]?.placeId).toBe('PL1');
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('deleting a place through the service detaches its facts in one undo step', () => {
    const { fixture, service } = makeService();
    try {
      service.addPerson({
        id: 'P1',
        names: [],
        sex: 'U',
        facts: [],
      });
      service.addPlace(moscow);
      service.addFact({
        id: 'F1',
        personId: 'P1',
        tag: 'BIRT',
        date: { quality: 'exact', component: { year: 1923 } },
        placeId: 'PL1',
        place: 'Moscow',
      });

      service.deletePlace(moscow);
      expect(service.getPlace('PL1')).toBeUndefined();
      expect(fixture.repo.listFactsForPerson('P1')[0]?.placeId).toBeUndefined();
      expect(fixture.repo.listFactsForPerson('P1')[0]?.place).toBe('Moscow');

      service.undo();
      expect(service.getPlace('PL1')).toEqual(moscow);
      expect(fixture.repo.listFactsForPerson('P1')[0]?.placeId).toBe('PL1');
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('updates a place through the service with undo', () => {
    const { fixture, service } = makeService();
    try {
      service.addPlace(moscow);
      const renamed: PlaceRecord = { ...moscow, latitude: 55.7, longitude: 37.6 };
      service.updatePlace(moscow, renamed);
      expect(fixture.repo.getPlace('PL1')?.latitude).toBe(55.7);

      service.undo();
      expect(fixture.repo.getPlace('PL1')?.latitude).toBeUndefined();
    } finally {
      cleanupRepo(fixture);
    }
  });
});
