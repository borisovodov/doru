import { describe, expect, it } from 'vitest';
import { parse, serializeGedcom551, serializeGedcom70, type GedcomDataset } from '@doru/gedcom';
import { buildGedcomDataset } from '../src/export/gedcom';
import { importGedcomDataset } from '../src/import/gedcom';
import { cleanupRepo, makeRepo } from './helpers';

function parseDataset(text: string): GedcomDataset {
  const result = parse(new TextEncoder().encode(text));
  if (!result.ok || result.value.kind !== 'dataset') {
    throw new Error('fixture failed to parse');
  }
  return result.value.dataset;
}

const GEDCOM = [
  '0 HEAD',
  '1 GEDC',
  '2 VERS 7.0',
  '0 @S1@ SOUR',
  '1 TITL Source',
  '0 @PL1@ _PLAC Moscow',
  '0 @O1@ OBJE',
  '1 FILE photos/a.jpg',
  '2 FORM image/jpeg',
  '3 MEDI PHOTO',
  '2 TITL File title',
  '2 _TEXT A transcription',
  '2 _CTYP person',
  '2 TRAN photos/a.png',
  '3 FORM image/png',
  '1 TITL Portrait',
  '1 _DATE 1900',
  '1 _PLAC Moscow',
  '1 _TYPE Photo',
  '1 _DSCR Studio portrait',
  '1 _KEYS family, portrait',
  '1 NOTE Record note',
  '1 SOUR @S1@',
  '0 @I1@ INDI',
  '1 NAME Ivan /Petrov/',
  '1 OBJE @O1@',
  '2 SOUR @S1@',
  '3 PAGE Link page',
  '0 TRLR',
].join('\n');

describe('media metadata', () => {
  it('keeps citations on anonymous media records', () => {
    const fixture = makeRepo();
    try {
      const parsed = parseDataset(
        [
          '0 HEAD',
          '1 GEDC',
          '2 VERS 7.0',
          '0 OBJE',
          '1 FILE photos/a.jpg',
          '1 SOUR @S1@',
          '0 @S1@ SOUR',
          '1 TITL Source',
          '0 TRLR',
        ].join('\n'),
      );
      importGedcomDataset(parsed, fixture.repo);
      const media = fixture.repo.listAllMedia()[0]!;
      const source = fixture.repo.listSources()[0]!;
      expect(fixture.repo.listCitationRecordsFor('media', media.id).map((citation) => citation.sourceId)).toEqual([
        source.id,
      ]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('derives a media title from FILE when no TITL exists', () => {
    const fixture = makeRepo();
    try {
      const parsed = parseDataset(
        [
          '0 HEAD',
          '1 GEDC',
          '2 VERS 7.0',
          '0 @O1@ OBJE',
          '1 FILE photos/family-1920.jpg',
          '0 @O2@ OBJE',
          '1 FILE photos/a.jpg',
          '2 TITL File title',
          '1 TITL Record title',
          '0 @O3@ OBJE',
          '1 FILE photos/record.jpg',
          '1 TITL Record title',
          '0 @O4@ OBJE',
          '1 FILE https://example.com/photos/Portrait%20of%20Anna.jpg?token=1',
          '0 TRLR',
        ].join('\n'),
      );
      importGedcomDataset(parsed, fixture.repo);
      const byPath = new Map(fixture.repo.listAllMedia().map((media) => [media.path, media]));
      expect(byPath.get('photos/family-1920.jpg')?.title).toBe('family-1920');
      expect(byPath.get('photos/a.jpg')?.title).toBe('File title');
      expect(byPath.get('photos/record.jpg')?.title).toBe('Record title');
      expect(byPath.get('https://example.com/photos/Portrait%20of%20Anna.jpg?token=1')?.title).toBe('Portrait of Anna');
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('imports inline crop and primary flags on a media link', () => {
    const fixture = makeRepo();
    try {
      const parsed = parseDataset(
        [
          '0 HEAD',
          '1 GEDC',
          '2 VERS 5.5.1',
          '1 SUBM @U1@',
          '0 @U1@ SUBM',
          '0 @I1@ INDI',
          '1 NAME One /Test/',
          '1 OBJE',
          '2 FILE photos/a.jpg',
          '2 FORM jpg',
          '2 _CROP',
          '3 _LEFT 1',
          '3 _TOP 2',
          '3 _WDTH 3',
          '3 _HGHT 4',
          '2 _PRIM Y',
          '0 TRLR',
        ].join('\n'),
      );
      importGedcomDataset(parsed, fixture.repo);
      const person = fixture.repo.listAllPersons()[0]!;
      const link = fixture.repo.listAttachmentsFor('person', person.id).mediaLinks[0]!.link;
      expect(link.crop).toEqual({ left: 1, top: 2, width: 3, height: 4 });
      expect(link.primary).toBe(true);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('does not mark an excluded media link as primary', () => {
    const fixture = makeRepo();
    try {
      const parsed = parseDataset(
        [
          '0 HEAD',
          '1 GEDC',
          '2 VERS 5.5.1',
          '1 SUBM @U1@',
          '0 @U1@ SUBM',
          '0 @I1@ INDI',
          '1 NAME One /Test/',
          '1 OBJE',
          '2 FILE photos/a.jpg',
          '2 FORM jpg',
          '2 _PRIM Y',
          '2 _EXCL Y',
          '0 TRLR',
        ].join('\n'),
      );
      importGedcomDataset(parsed, fixture.repo);
      const person = fixture.repo.listAllPersons()[0]!;
      const link = fixture.repo.listAttachmentsFor('person', person.id).mediaLinks[0]!.link;
      expect(link.primary).toBeUndefined();
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('imports the media title and date and drops the historical metadata', () => {
    const fixture = makeRepo();
    try {
      importGedcomDataset(parseDataset(GEDCOM), fixture.repo);
      const media = fixture.repo.listAllMedia()[0]!;
      expect(media).toMatchObject({
        title: 'File title',
        path: 'photos/a.jpg',
      });
      expect(media).not.toHaveProperty('place');
      expect(media).not.toHaveProperty('placeId');
      expect(media).not.toHaveProperty('objectType');
      expect(media).not.toHaveProperty('description');
      expect(media).not.toHaveProperty('keywords');
      expect(media).not.toHaveProperty('medium');
      expect(media).not.toHaveProperty('contentType');
      expect(media).not.toHaveProperty('text');
      expect(media.date).toMatchObject({ component: { year: 1900 } });
      expect(fixture.repo.listNotesFor('media', media.id).map((note) => note.text)).toEqual(['Record note']);
      expect(fixture.repo.listCitationRecordsFor('media', media.id)).toHaveLength(1);

      const person = fixture.repo.listAllPersons()[0]!;
      const link = fixture.repo.listAttachmentsFor('person', person.id).mediaLinks[0]!.link;
      expect(link).toMatchObject({ mediaId: media.id, targetType: 'person', targetId: person.id });
      expect(fixture.repo.listCitationRecordsFor('media_link', link.id)).toEqual([]);

      for (const serialize of [serializeGedcom70, serializeGedcom551]) {
        const serialized = serialize(buildGedcomDataset(fixture.repo));
        expect(serialized.ok).toBe(true);
        if (!serialized.ok) {
          continue;
        }
        const text = serialized.value;
        expect(text).toContain('1 _DATE 1900');
        expect(text).not.toContain('_PLAC Moscow');
        expect(text).not.toContain('_TYPE Photo');
        expect(text).not.toContain('_DSCR Studio portrait');
        expect(text).not.toContain('_KEYS family, portrait');
        expect(text).not.toContain('_TEXT A transcription');
        expect(text).not.toContain('_CTYP person');
        expect(text).toContain('1 SOUR @S1@');
        expect(text).not.toContain('PAGE Link page');

        const target = makeRepo();
        try {
          importGedcomDataset(parseDataset(text), target.repo);
          const imported = target.repo.listAllMedia()[0]!;
          expect(imported).toMatchObject({
            title: 'File title',
            path: 'photos/a.jpg',
          });
          expect(imported.date).toMatchObject({ component: { year: 1900 } });
          expect(target.repo.listNotesFor('media', imported.id).map((note) => note.text)).toEqual(['Record note']);
          const importedSource = target.repo.listSources()[0]!;
          expect(target.repo.listCitationRecordsFor('media', imported.id).map((citation) => citation.sourceId)).toEqual(
            [importedSource.id],
          );
          const importedPerson = target.repo.listAllPersons()[0]!;
          const importedLink = target.repo.listAttachmentsFor('person', importedPerson.id).mediaLinks[0]!.link;
          expect(target.repo.listCitationRecordsFor('media_link', importedLink.id)).toEqual([]);
        } finally {
          cleanupRepo(target);
        }
      }
    } finally {
      cleanupRepo(fixture);
    }
  });
});
