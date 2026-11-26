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

      const detach = deletePlaceOp(moscow, [{ before: fact, after: { ...fact, placeId: undefined } }]);
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
      expect(service.getPlace('PL1')).toMatchObject(moscow);
      expect(fixture.repo.listFactsForPerson('P1')[0]?.placeId).toBe('PL1');
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('restores additional places at their stored positions', () => {
    const { fixture, service } = makeService();
    try {
      service.addPerson({ id: 'P1', names: [], sex: 'U', facts: [] });
      for (const id of ['PL1', 'PL2', 'PL3', 'PL4']) {
        service.addPlace({ id, names: [{ id: `PN-${id}`, kind: 'official', position: 0, value: id }] });
      }
      service.addFact({
        id: 'F1',
        personId: 'P1',
        tag: 'BIRT',
        additionalPlaceIds: ['PL1', 'PL2', 'PL3', 'PL4'],
      });

      service.deletePlace(fixture.repo.getPlace('PL1')!);
      service.deletePlace(fixture.repo.getPlace('PL4')!);
      expect(fixture.repo.listFactsForPerson('P1')[0]?.additionalPlaceIds).toEqual(['PL2', 'PL3']);

      service.undo();
      expect(fixture.repo.listFactsForPerson('P1')[0]?.additionalPlaceIds).toEqual(['PL2', 'PL3', 'PL4']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('redo deletes and restores the place when nothing changed', () => {
    const { fixture, service } = makeService();
    try {
      service.addPlace(moscow);
      service.deletePlace(moscow);
      const undone = service.undo();
      expect(fixture.repo.getPlace('PL1')).toBeDefined();
      expect(undone.canRedo).toBe(true);
      const state = service.redo();
      expect(state.redoBlocked).toBeUndefined();
      expect(fixture.repo.getPlace('PL1')).toBeUndefined();
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('rejects place redo when new attachments appeared', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPlace(moscow);
      service.deletePlace(moscow);
      service.undo();
      repo.insertNote({ id: 'N1', text: 'new note', targetType: 'place', targetId: 'PL1' });

      const state = service.redo();
      expect(state.redoBlocked).toBe(true);
      expect(repo.getPlace('PL1')).toBeDefined();
      expect(repo.listNotesFor('place', 'PL1').map((entry) => entry.id)).toEqual(['N1']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('rejects place redo when a fact reference kind changed', () => {
    const { fixture, service } = makeService();
    const { repo } = fixture;
    try {
      service.addPerson({ id: 'P1', names: [], sex: 'U', facts: [] });
      service.addPlace(moscow);
      service.addFact({ id: 'F1', personId: 'P1', tag: 'BIRT', additionalPlaceIds: ['PL1'] });
      service.deletePlace(moscow);
      service.undo();

      repo.updateFact({ ...repo.getFact('F1')!, placeId: 'PL1', additionalPlaceIds: undefined });
      expect(service.redo().redoBlocked).toBe(true);
      expect(repo.getPlace('PL1')).toBeDefined();
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('gives each place name its own date row even when a date id is reused', () => {
    const { fixture, service } = makeService();
    try {
      const date = { id: 'SHARED-DATE', quality: 'exact' as const, component: { year: 1900 } };
      service.addPlace({
        id: 'PL1',
        names: [{ id: 'PN1', kind: 'official', position: 0, value: 'One', date }],
      });
      service.addPlace({
        id: 'PL2',
        names: [{ id: 'PN2', kind: 'official', position: 0, value: 'Two', date }],
      });
      const secondDateId = fixture.repo.getPlace('PL2')?.names[0]?.date?.id;
      expect(secondDateId).toBeDefined();
      expect(secondDateId).not.toBe('SHARED-DATE');

      service.deletePlace(fixture.repo.getPlace('PL1')!);
      expect(fixture.repo.getPlace('PL2')?.names[0]?.date).toMatchObject({
        id: secondDateId,
        component: { year: 1900 },
      });
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
