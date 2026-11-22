import { describe, expect, it } from 'vitest';
import { deleteMediaOp } from '../src/ops/media';
import { OpQueue } from '../src/ops/op';
import { TreeService } from '../src/service/tree';
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

  it('restores media without a vanished historical place link', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertPerson({ id: 'P1', names: [], sex: 'U', facts: [] });
      repo.insertPlace({ id: 'PL1', names: [{ id: 'PN1', kind: 'official', position: 0, value: 'Moscow' }] });
      repo.insertMedia({
        id: 'M1',
        title: 'Portrait',
        place: 'Moscow',
        placeId: 'PL1',
        targetType: 'person',
        targetId: 'P1',
      });
      const media = repo.getMedia('M1')!;

      const del = deleteMediaOp(media);
      del.apply({ repo });
      // Another writer removes the place while the media record is gone.
      repo.deletePlace('PL1');
      del.inverse({ repo });

      const restored = repo.getMedia('M1')!;
      expect(restored.place).toBe('Moscow');
      expect(restored.placeId).toBeUndefined();
      expect(restored.links?.map((link) => link.targetId)).toEqual(['P1']);
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
        description: 'Draft',
        path: 'media/a.jpg',
        targetType: 'person',
        targetId: 'P1',
      });
      const stale = repo.getMedia('M1')!;
      const service = new TreeService(repo, new OpQueue());
      repo.updateMedia({ ...repo.getMedia('M1')!, description: 'Concurrent' });
      service.updateMedia(stale, { ...stale, title: 'New' });
      expect(repo.getMedia('M1')).toMatchObject({ title: 'New', description: 'Concurrent' });

      const beforePath = repo.getMedia('M1')!;
      service.updateMedia(beforePath, { ...beforePath, path: 'media/b.jpg', files: undefined });
      expect(repo.getMedia('M1')?.path).toBe('media/b.jpg');
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('includes a restored self-file link in the media redo baseline', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertPerson({ id: 'P1', names: [], sex: 'U', facts: [] });
      repo.insertMedia({
        id: 'M1',
        path: 'media/a.jpg',
        files: [{ id: 'MF1', path: 'media/a.jpg' }],
        targetType: 'person',
        targetId: 'P1',
      });
      repo.addMediaLink('M1', { id: 'ML1', mediaId: 'M1', targetType: 'media_file', targetId: 'MF1' });
      const service = new TreeService(repo, new OpQueue());
      service.deleteMedia(repo.getMedia('M1')!);
      service.undo();
      expect(repo.getMedia('M1')?.links?.map((link) => link.id)).toContain('ML1');
      expect(service.redo().redoBlocked).toBeUndefined();
      expect(repo.getMedia('M1')).toBeUndefined();
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('preserves a concurrently added media file when one file is renamed', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertMedia({ id: 'M1', title: 'Photo', files: [{ id: 'F1', path: 'media/a.jpg' }] });
      const before = repo.getMedia('M1')!;
      repo.updateMedia({
        ...before,
        files: [...before.files!, { id: 'F2', path: 'media/b.jpg' }],
      });
      const service = new TreeService(repo, new OpQueue());
      service.updateMedia(before, {
        ...before,
        files: [{ ...before.files![0]!, title: 'Renamed' }],
      });
      expect(repo.getMedia('M1')?.files).toEqual([
        expect.objectContaining({ id: 'F1', title: 'Renamed' }),
        expect.objectContaining({ id: 'F2' }),
      ]);
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

  it('round-trips historical fields, file metadata, translations and link citations', () => {
    const fixture = makeRepo();
    try {
      const { repo, store } = fixture;
      repo.insertPlace({ id: 'PL1', names: [{ id: 'PN1', kind: 'official', position: 0, value: 'Moscow' }] });
      repo.insertSource({ id: 'S1', title: 'Source' });
      repo.insertMedia({
        id: 'M1',
        title: 'Portrait',
        date: { quality: 'exact', component: { year: 1900 } },
        place: 'Moscow',
        placeId: 'PL1',
        objectType: 'Photo',
        description: 'Studio portrait',
        keywords: 'family, portrait',
        targetType: 'person',
        targetId: 'P1',
        files: [
          {
            id: 'F1',
            path: 'media/a.jpg',
            title: 'File title',
            medium: 'photograph',
            contentType: 'person',
            text: 'Transcription',
            translations: [{ id: 'T1', path: 'media/a.png', position: 0 }],
          },
        ],
      });

      const read = repo.getMedia('M1')!;
      expect(read).toMatchObject({
        title: 'Portrait',
        place: 'Moscow',
        placeId: 'PL1',
        objectType: 'Photo',
        description: 'Studio portrait',
        keywords: 'family, portrait',
      });
      expect(read.date).toMatchObject({ quality: 'exact', component: { year: 1900 } });
      expect(read.files?.[0]).toMatchObject({
        id: 'F1',
        path: 'media/a.jpg',
        title: 'File title',
        medium: 'photograph',
        contentType: 'person',
        text: 'Transcription',
        translations: [{ id: 'T1', path: 'media/a.png', position: 0 }],
      });

      const link = repo.listAttachmentsFor('person', 'P1').mediaLinks[0]!.link;
      repo.insertCitation({ id: 'C1', sourceId: 'S1', targetType: 'media_link', targetId: link.id });
      expect(repo.listCitationRecordsFor('media_link', link.id).map((citation) => citation.id)).toEqual(['C1']);
      expect(repo.listAttachmentsFor('person', 'P1').mediaLinkAttachments[0]?.attachments.citations).toHaveLength(1);

      repo.updateMedia({ id: 'M1', title: 'Renamed' });
      expect(repo.getMedia('M1')?.date).toBeUndefined();
      expect(repo.getMedia('M1')?.files).toEqual([]);
      expect((store.db.prepare('SELECT COUNT(*) AS n FROM date').get() as { n: number }).n).toBe(0);

      repo.deleteAttachmentsFor('person', 'P1');
      expect(repo.getMedia('M1')).toBeUndefined();
      expect(repo.listCitationRecordsFor('media_link', link.id)).toEqual([]);
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
