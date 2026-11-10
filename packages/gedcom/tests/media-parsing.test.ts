import { describe, expect, test } from 'vitest';
import { parseGedcom70 } from '../src/parsing/assemble';
import type { GedcomDataset } from '../src/structures';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

function parseOk(text: string | string[]): GedcomDataset {
  const source = Array.isArray(text) ? text.join('\n') : text;
  const result = parseGedcom70(enc(source));
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.value;
}

describe('media record vendor tags', () => {
  test('parses an OBJE record with vendor fields', () => {
    const dataset = parseOk([
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '1 SUBM @U1@',
      '0 @U1@ SUBM',
      '0 @M1@ OBJE',
      '1 FILE media/photo.jpg',
      '2 FORM jpeg',
      '2 TITL The portrait',
      '2 TEXT a transcription',
      '2 _DATE 2026-01-01',
      '2 DATE 2026-02-02',
      '1 _SCBK Y',
      '1 _SSHOW Y',
      '1 _TYPE photo',
      '1 _SOUND sound.wav',
      '1 _KEYS key1 key2',
      '1 _FILE path.jpg',
      '1 _NOTE a media note',
      '1 _NOTA another note',
      '1 _TEXT comment text',
      '1 TEXT comment text 2',
      '1 _CREA 2026-03-03',
      '1 _CRE',
      '2 DATE 2026',
      '1 UID uid-1',
      '1 _SUBM @U1@',
      '1 _IMPF imp-1',
      '1 _CLON',
      '2 _TID tree1',
      '2 _PID p1',
      '2 _OID uuid-1',
      '2 _USER user1',
      '3 _ENCR 1',
      '2 _DATE 2020',
      '2 _UNKNOWN x',
      '1 TITL record title',
      '1 BLOB blob bytes',
      '2 NOTE on the blob',
      '1 WWW https://m.example',
      '1 _TAG @T1@',
      '1 _TAG not a pointer',
      '0 @M2@ OBJE',
      '0 @T1@ _TAG',
      '1 NAME favorites',
      '0 TRLR',
    ]);
    const media = dataset.records.find((entry) => entry.tag === 'OBJE' && entry.xref === '@M1@');
    expect(media).toMatchObject({
      scrapbook: true,
      slideshow: true,
      objectType: 'photo',
      soundFile: 'sound.wav',
      keywords: 'key1 key2',
      filePath: 'path.jpg',
      mediaNote: 'comment text 2',
      title: 'record title',
      embeddedBlob: 'blob bytes',
      createdAt: '2026-03-03',
      creationDate: expect.anything(),
      submitters: ['@U1@'],
      importReference: expect.anything(),
      tagLinks: [{ tag: '_TAG', target: '@T1@' }],
      notes: expect.arrayContaining([expect.objectContaining({ payload: 'another note' })]),
      clones: [
        {
          tag: '_CLON',
          treeId: 'tree1',
          personId: 'p1',
          objectId: 'uuid-1',
          user: 'user1',
          date: '2020',
          userEncrypted: true,
          extensions: expect.arrayContaining([expect.objectContaining({ tag: '_UNKNOWN' })]),
        },
      ],
      files: [
        {
          payload: 'media/photo.jpg',
          form: expect.anything(),
          title: 'The portrait',
          text: 'a transcription',
          date: '2026-02-02',
        },
      ],
      extensions: expect.arrayContaining([
        expect.objectContaining({ tag: '_TAG', payload: 'not a pointer' }),
        expect.objectContaining({ tag: 'WWW' }),
        expect.objectContaining({ tag: 'NOTE', payload: 'on the blob' }),
      ]),
    });
  });
});
