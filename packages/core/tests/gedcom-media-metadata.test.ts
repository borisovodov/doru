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

describe('media historical metadata', () => {
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

  it('keeps place-media citations that point at a later source', () => {
    const fixture = makeRepo();
    try {
      const parsed = parseDataset(
        [
          '0 HEAD',
          '1 GEDC',
          '2 VERS 7.0',
          '0 @O1@ OBJE',
          '1 FILE photos/a.jpg',
          '0 @PL1@ _PLAC Moscow',
          '1 OBJE @O1@',
          '2 SOUR @S2@',
          '0 @S2@ SOUR',
          '1 TITL Later',
          '0 TRLR',
        ].join('\n'),
      );
      importGedcomDataset(parsed, fixture.repo);
      const place = fixture.repo.listPlaces().find((entry) => entry.xref === '@PL1@')!;
      const s2 = fixture.repo.listSources().find((source) => source.xref === '@S2@')!;
      const link = fixture.repo.listAttachmentsFor('place', place.id).mediaLinks[0]!.link;
      expect(fixture.repo.listCitationRecordsFor('media_link', link.id).map((citation) => citation.sourceId)).toEqual([
        s2.id,
      ]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('keeps source media-link citations that point at a later source', () => {
    const fixture = makeRepo();
    try {
      const parsed = parseDataset(
        [
          '0 HEAD',
          '1 GEDC',
          '2 VERS 7.0',
          '0 @O1@ OBJE',
          '1 FILE photos/a.jpg',
          '0 @S1@ SOUR',
          '1 TITL First',
          '1 OBJE @O1@',
          '2 SOUR @S2@',
          '0 @S2@ SOUR',
          '1 TITL Second',
          '0 TRLR',
        ].join('\n'),
      );
      importGedcomDataset(parsed, fixture.repo);
      const s1 = fixture.repo.listSources().find((source) => source.xref === '@S1@')!;
      const s2 = fixture.repo.listSources().find((source) => source.xref === '@S2@')!;
      const link = fixture.repo.listAttachmentsFor('source', s1.id).mediaLinks[0]!.link;
      expect(fixture.repo.listCitationRecordsFor('media_link', link.id).map((citation) => citation.sourceId)).toEqual([
        s2.id,
      ]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('imports the historical record/file fields and round-trips them', () => {
    const fixture = makeRepo();
    try {
      importGedcomDataset(parseDataset(GEDCOM), fixture.repo);
      const media = fixture.repo.listAllMedia()[0]!;
      expect(media).toMatchObject({
        title: 'Portrait',
        place: 'Moscow',
        objectType: 'Photo',
        description: 'Studio portrait',
        keywords: 'family, portrait',
      });
      expect(media.placeId).toBeDefined();
      expect(media.date).toMatchObject({ component: { year: 1900 } });
      expect(media.files?.[0]).toMatchObject({
        path: 'photos/a.jpg',
        title: 'File title',
        medium: 'PHOTO',
        contentType: 'person',
        text: 'A transcription',
        translations: [{ path: 'photos/a.png', position: 0 }],
      });
      expect(fixture.repo.listNotesFor('media', media.id).map((note) => note.text)).toEqual(['Record note']);
      expect(fixture.repo.listCitationRecordsFor('media', media.id)).toHaveLength(1);

      const person = fixture.repo.listAllPersons()[0]!;
      const link = fixture.repo.listAttachmentsFor('person', person.id).mediaLinks[0]!.link;
      expect(fixture.repo.listCitationRecordsFor('media_link', link.id).map((citation) => citation.page)).toEqual([
        'Link page',
      ]);

      for (const serialize of [serializeGedcom70, serializeGedcom551]) {
        const serialized = serialize(buildGedcomDataset(fixture.repo));
        expect(serialized.ok).toBe(true);
        if (!serialized.ok) {
          continue;
        }
        const text = serialized.value;
        expect(text).toContain('1 _DATE 1900');
        expect(text).toContain('1 _PLAC Moscow');
        expect(text).toContain('1 _TYPE Photo');
        expect(text).toContain('1 _DSCR Studio portrait');
        expect(text).toContain('1 _KEYS family, portrait');
        expect(text).toContain('2 _TEXT A transcription');
        expect(text).toContain('2 _CTYP person');
        expect(text).toContain('2 SOUR @S1@');
        expect(text).toContain('3 PAGE Link page');
        if (serialize === serializeGedcom70) {
          expect(text).toContain('2 TRAN photos/a.png');
          expect(text).toContain('3 FORM image/png');
        } else {
          expect(text).not.toContain('2 TRAN');
        }

        const target = makeRepo();
        try {
          importGedcomDataset(parseDataset(text), target.repo);
          const imported = target.repo.listAllMedia()[0]!;
          expect(imported).toMatchObject({
            title: 'Portrait',
            place: 'Moscow',
            objectType: 'Photo',
            description: 'Studio portrait',
            keywords: 'family, portrait',
          });
          expect(imported.date).toMatchObject({ component: { year: 1900 } });
          expect(imported.files?.[0]).toMatchObject({
            medium: 'PHOTO',
            contentType: 'person',
            text: 'A transcription',
          });
          if (serialize === serializeGedcom70) {
            expect(imported.files?.[0]?.translations?.[0]).toMatchObject({ path: 'photos/a.png', position: 0 });
          } else {
            expect(imported.files?.[0]?.translations).toEqual([]);
          }
          const importedPerson = target.repo.listAllPersons()[0]!;
          const importedLink = target.repo.listAttachmentsFor('person', importedPerson.id).mediaLinks[0]!.link;
          expect(target.repo.listCitationRecordsFor('media_link', importedLink.id)).toHaveLength(1);
        } finally {
          cleanupRepo(target);
        }
      }
    } finally {
      cleanupRepo(fixture);
    }
  });
});
