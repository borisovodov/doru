import { describe, expect, it } from 'vitest';
import { cleanupRepo, makeRepo } from './helpers';

describe('media repo edge cases', () => {
  it('updates media records and lists links with their records', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertMedia({ id: 'M1', path: 'media/a.jpg', title: 'Photo', targetType: 'person', targetId: 'P1' });
      repo.updateMedia({ id: 'M1', xref: '@M1@', title: 'Renamed' });
      expect(repo.getMedia('M1')).toMatchObject({ title: 'Renamed', xref: '@M1@' });

      const links = repo.listAttachmentsFor('person', 'P1').mediaLinks;
      expect(links).toHaveLength(1);
      expect(links[0]?.media).toMatchObject({ id: 'M1', title: 'Renamed' });
      expect(links[0]?.link).toMatchObject({ mediaId: 'M1', targetType: 'person', targetId: 'P1' });
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('keeps a shared media record while any link remains and removes it with the last', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertMedia({ id: 'M1', path: 'media/a.jpg', targetType: 'person', targetId: 'P1' });
      repo.addMediaLink('M1', { id: 'L2', mediaId: 'M1', targetType: 'person', targetId: 'P2' });

      repo.deleteAttachmentsFor('person', 'P1');
      // One link remains, the record survives.
      expect(repo.getMedia('M1')).toBeDefined();

      repo.deleteAttachmentsFor('person', 'P2');
      // The last link went away, so did the record.
      expect(repo.getMedia('M1')).toBeUndefined();
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('removeMediaLink deletes an orphaned record but keeps a shared one', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertMedia({ id: 'M1', path: 'media/a.jpg', targetType: 'person', targetId: 'P1' });
      const [first] = repo.listAttachmentsFor('person', 'P1').mediaLinks!;
      repo.addMediaLink('M1', { id: 'L2', mediaId: 'M1', targetType: 'person', targetId: 'P2' });

      repo.removeMediaLink(first!.link.id);
      expect(repo.getMedia('M1')).toBeDefined();

      const [second] = repo.listAttachmentsFor('person', 'P2').mediaLinks!;
      repo.removeMediaLink(second!.link.id);
      expect(repo.getMedia('M1')).toBeUndefined();
      expect(repo.removeMediaLink('missing')).toBe(false);
    } finally {
      cleanupRepo(fixture);
    }
  });
});

describe('place repo edge cases', () => {
  it('returns every place for an empty search', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertPlace({ id: 'P1', names: [{ id: 'N1', kind: 'official', position: 0, value: 'Moscow' }] });
      repo.insertPlace({ id: 'P2', names: [{ id: 'N2', kind: 'official', position: 0, value: 'Berlin' }] });
      expect(repo.searchPlaces('').map((place) => place.id)).toEqual(['P1', 'P2']);
      expect(repo.searchPlaces('', 1).map((place) => place.id)).toEqual(['P1']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('round-trips hierarchy, postal codes and their dates', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertPlace({ id: 'P2', names: [{ id: 'N2', kind: 'official', position: 0, value: 'Russia' }] });
      repo.insertPlace({ id: 'P3', names: [{ id: 'N3', kind: 'official', position: 0, value: 'Europe' }] });
      repo.insertPlace({
        id: 'P1',
        names: [{ id: 'N1', kind: 'official', position: 0, value: 'Moscow' }],
        hierarchy: [{ parentId: 'P2', type: 'part-of' }, { parentId: 'P3' }],
        postalCodes: [
          { id: 'PC1', code: '101000', date: { quality: 'exact' as const, component: { year: 2020 } } },
          { id: 'PC2', code: '101001' },
        ],
      });

      const read = repo.getPlace('P1')!;
      // Hierarchy rows come back ordered by their type (null first).
      expect(read.hierarchy).toEqual([{ parentId: 'P3' }, { parentId: 'P2', type: 'part-of' }]);
      expect(read.postalCodes).toEqual([
        { id: 'PC1', code: '101000', date: expect.objectContaining({ component: { year: 2020 } }) },
        { id: 'PC2', code: '101001' },
      ]);
    } finally {
      cleanupRepo(fixture);
    }
  });
});
