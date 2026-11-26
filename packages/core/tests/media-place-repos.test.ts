import { describe, expect, it } from 'vitest';
import { OpQueue } from '../src/ops/op';
import { TreeService } from '../src/service/tree';
import { cleanupRepo, makeRepo } from './helpers';

describe('media repo edge cases', () => {
  it('updates media records and lists links with their records', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertMedia({ id: 'M1', path: 'media/a.jpg', title: 'Photo', targetType: 'person', targetId: 'P1' });
      repo.updateMedia({ ...repo.getMedia('M1')!, title: 'Renamed' });
      expect(repo.getMedia('M1')).toMatchObject({ title: 'Renamed' });

      const links = repo.listAttachmentsFor('person', 'P1').mediaLinks;
      expect(links).toHaveLength(1);
      expect(links[0]?.media).toMatchObject({ id: 'M1', title: 'Renamed' });
      expect(links[0]?.link).toMatchObject({ mediaId: 'M1', targetType: 'person', targetId: 'P1' });
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('merges concurrent media metadata and honors path-only edits', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertPerson({ id: 'P1', names: [], sex: 'U', facts: [] });
      repo.insertMedia({
        id: 'M1',
        title: 'Old',
        path: 'media/a.jpg',
        targetType: 'person',
        targetId: 'P1',
      });
      const stale = repo.getMedia('M1')!;
      const service = new TreeService(repo, new OpQueue());
      repo.updateMedia({ ...repo.getMedia('M1')!, title: 'Concurrent' });
      service.updateMedia(stale, { ...stale, path: 'media/b.jpg' });
      expect(repo.getMedia('M1')).toMatchObject({ title: 'Concurrent', path: 'media/b.jpg' });

      const before = repo.getMedia('M1')!;
      service.updateMedia(before, { ...before, title: 'New' });
      expect(repo.getMedia('M1')?.title).toBe('New');
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('keeps a shared media record even when its last link is removed', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertMedia({ id: 'M1', path: 'media/a.jpg', targetType: 'person', targetId: 'P1' });
      repo.addMediaLink('M1', { id: 'L2', mediaId: 'M1', targetType: 'person', targetId: 'P2' });

      repo.deleteAttachmentsFor('person', 'P1');
      // One link remains, the record survives.
      expect(repo.getMedia('M1')).toBeDefined();

      repo.deleteAttachmentsFor('person', 'P2');
      // The last link went away, but the shared record stays in the library.
      expect(repo.getMedia('M1')?.links).toEqual([]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('removeMediaLink deletes an orphaned record but keeps a shared one', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertMedia({ id: 'M1', path: 'media/a.jpg', targetType: 'person', targetId: 'P1' });
      const [first] = repo.listAttachmentsFor('person', 'P1').mediaLinks;
      repo.addMediaLink('M1', { id: 'L2', mediaId: 'M1', targetType: 'person', targetId: 'P2' });

      repo.removeMediaLink(first!.link.id);
      expect(repo.getMedia('M1')).toBeDefined();

      const [second] = repo.listAttachmentsFor('person', 'P2').mediaLinks;
      repo.removeMediaLink(second!.link.id);
      expect(repo.getMedia('M1')).toBeUndefined();
      expect(repo.removeMediaLink('missing')).toBe(false);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('round-trips the media title and historical date', () => {
    const fixture = makeRepo();
    try {
      const { repo, store } = fixture;
      repo.insertMedia({
        id: 'M1',
        path: 'media/a.jpg',
        title: 'File title',
        date: { quality: 'exact', component: { year: 1900 } },
        targetType: 'person',
        targetId: 'P1',
      });

      const read = repo.getMedia('M1')!;
      expect(read).toMatchObject({
        title: 'File title',
        path: 'media/a.jpg',
      });
      expect(read.date).toMatchObject({ quality: 'exact', component: { year: 1900 } });

      repo.updateMedia({ ...repo.getMedia('M1')!, title: 'Renamed', date: undefined });
      expect(repo.getMedia('M1')?.date).toBeUndefined();
      expect((store.db.prepare('SELECT COUNT(*) AS n FROM date').get() as { n: number }).n).toBe(0);

      repo.deleteAttachmentsFor('person', 'P1');
      expect(repo.getMedia('M1')?.links).toEqual([]);
    } finally {
      cleanupRepo(fixture);
    }
  });
});

describe('place repo edge cases', () => {
  it('round-trips hierarchy, postal codes and their dates', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertPlace({ id: 'P2', names: [{ id: 'N2', kind: 'official', position: 0, value: 'Russia' }] });
      repo.insertPlace({ id: 'P3', names: [{ id: 'N3', kind: 'official', position: 0, value: 'Europe' }] });
      repo.insertPlace({
        id: 'P1',
        names: [{ id: 'N1', kind: 'official', position: 0, value: 'Moscow' }],
        hierarchy: [
          { id: 'H1', parentId: 'P2', type: 'part-of' },
          { id: 'H2', parentId: 'P3' },
        ],
        postalCodes: [
          { id: 'PC1', code: '101000', date: { quality: 'exact' as const, component: { year: 2020 } } },
          { id: 'PC2', code: '101001' },
        ],
      });

      const read = repo.getPlace('P1')!;
      // Hierarchy rows come back ordered by their type (null first).
      expect(read.hierarchy).toEqual([
        { id: 'H2', parentId: 'P3' },
        { id: 'H1', parentId: 'P2', type: 'part-of' },
      ]);
      expect(read.postalCodes).toEqual([
        { id: 'PC1', code: '101000', date: expect.objectContaining({ component: { year: 2020 } }) },
        { id: 'PC2', code: '101001' },
      ]);

      const postalDate = read.postalCodes?.[0]?.date;
      expect(postalDate?.id).toBeDefined();
      repo.updatePlace({
        ...read,
        names: [...read.names, { id: 'N4', kind: 'official', position: 1, value: 'Copy', date: postalDate }],
      });
      const after = repo.getPlace('P1')!;
      expect(after.postalCodes?.find((entry) => entry.id === 'PC1')?.date?.id).toBe(postalDate?.id);
      expect(after.names.find((entry) => entry.id === 'N4')?.date?.id).not.toBe(postalDate?.id);
    } finally {
      cleanupRepo(fixture);
    }
  });
});
