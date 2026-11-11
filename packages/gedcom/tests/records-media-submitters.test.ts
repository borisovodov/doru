import { describe, expect, test } from 'vitest';
import { parseGedcom551, parseGedcom70 } from '../src/parsing/assemble';
import type { GedcomDataset } from '../src/structures';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

function parse70(text: string): GedcomDataset {
  const result = parseGedcom70(enc(text));
  if (!result.ok) {
    throw new Error(JSON.stringify(result));
  }
  return result.value;
}

function err70(text: string): string {
  const result = parseGedcom70(enc(text));
  if (result.ok) {
    throw new Error('expected an error');
  }
  return (result.error as { code: string }).code;
}

function parse551(text: string): GedcomDataset {
  const result = parseGedcom551(enc(text));
  if (!result.ok) {
    throw new Error(JSON.stringify(result));
  }
  return result.value;
}

function err551(text: string): string {
  const result = parseGedcom551(enc(text));
  if (result.ok) {
    throw new Error('expected an error');
  }
  return (result.error as { code: string }).code;
}

const H551 = ['0 HEAD', '1 SOUR PAF', '1 SUBM @S1@', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8'];
const SUBM = ['0 @S1@ SUBM', '1 NAME Tester'];

describe('multimedia records', () => {
  test('7.0 OBJE parses every 7.0 field', () => {
    const dataset = parse70(
      [
        '0 HEAD', '1 GEDC', '2 VERS 7.0',
        '0 @O1@ OBJE',
        '1 RESN LOCKED',
        '1 FILE a.jpg',
        '2 FORM image/jpeg',
        '3 MEDI PHOTO',
        '4 PHRASE A photo',
        '2 TITL The picture',
        '2 TRAN en',
        '3 FORM image/jpeg',
        '1 FILE b.png',
        '2 FORM image/png',
        '1 _DATE 3 JAN 2000',
        '1 _TYPE portrait',
        '1 _SOUND s.wav',
        '1 NOTE a note',
        '1 SOUR @S2@',
        '1 CHAN',
        '2 DATE 4 JAN 2001',
        '1 CREA',
        '2 DATE 5 JAN 2001',
        '1 UID 550e8400',
        '1 _UID legacy',
        '1 EXID https://example.com/o1',
        '2 TYPE https://example.com/type',
        '1 REFN r1',
        '2 TYPE user',
        '0 @S2@ SOUR',
        '1 TITL S',
        '0 TRLR',
      ].join('\n'),
    );
    const rec = dataset.records[0] as {
      tag: 'OBJE'; restriction?: string[]; files: Array<{
        payload: string; form: { payload: string; medium?: { payload: string; phrase?: string } };
        title?: string; translations?: Array<{ payload: string; form: { payload: string } }>;
      }>;
      date?: { value?: unknown }; objectType?: string; soundFile?: string;
      notes?: unknown[]; citations?: unknown[]; changeDate?: { date: { value: unknown } };
      creationDate?: { date: { value: unknown } };
      identifiers?: Array<{ tag: string; payload: string; type?: string }>;
    };
    expect(rec.restriction).toEqual(['LOCKED']);
    expect(rec.files).toHaveLength(2);
    expect(rec.files[0]?.form.medium?.payload).toBe('PHOTO');
    expect(rec.files[0]?.form.medium?.phrase).toBe('A photo');
    expect(rec.files[0]?.title).toBe('The picture');
    expect(rec.files[0]?.translations?.[0]).toEqual({ payload: 'en', form: { payload: 'image/jpeg' } });
    expect(rec.date).toBeDefined();
    expect(rec.objectType).toBe('portrait');
    expect(rec.soundFile).toBe('s.wav');
    expect(rec.notes).toHaveLength(1);
    expect(rec.citations).toHaveLength(1);
    expect(rec.changeDate).toBeDefined();
    expect(rec.creationDate).toBeDefined();
    expect(rec.identifiers?.map((id) => id.tag)).toEqual(['UID', 'UID', 'EXID', 'REFN']);
    expect((rec.identifiers?.[2] as { type?: string }).type).toBe('https://example.com/type');
  });

  test('5.5.1 OBJE parses RIN and _UID with a fixed media format', () => {
    const dataset = parse551(
      [
        ...H551,
        '0 @O1@ OBJE',
        '1 FILE a.jpg',
        '2 FORM jpg',
        '3 TYPE PHOTO',
        '1 _DATE 3 JAN 2000',
        '1 _TYPE portrait',
        '1 _SOUND s.wav',
        '1 NOTE a note',
        '1 SOUR @S2@',
        '1 CHAN',
        '2 DATE 4 JAN 2001',
        '1 REFN r1',
        '1 RIN 42',
        '1 _UID legacy',
        ...SUBM,
        '0 @S2@ SOUR',
        '1 TITL S',
        '0 TRLR',
      ].join('\n'),
    );
    const rec = dataset.records[0] as {
      tag: 'OBJE'; files: Array<{ payload: string; form: { payload: string; medium?: { payload: string } } }>;
      identifiers?: Array<{ tag: string; payload: string }>; automatedRecordId?: string;
      date?: { value?: unknown }; objectType?: string; soundFile?: string; notes?: unknown[]; citations?: unknown[]; changeDate?: unknown;
    };
    expect(rec.files[0]?.form.payload).toBe('jpg');
    expect(rec.files[0]?.form.medium?.payload).toBe('PHOTO');
    expect(rec.date).toBeDefined();
    expect(rec.objectType).toBe('portrait');
    expect(rec.soundFile).toBe('s.wav');
    expect(rec.notes).toHaveLength(1);
    expect(rec.citations).toHaveLength(1);
    expect(rec.changeDate).toBeDefined();
    expect(rec.identifiers?.map((id) => id.tag)).toEqual(['REFN', 'UID']);
    expect(rec.automatedRecordId).toBe('42');
  });

  test('OBJE without a FILE parses with no files', () => {
    const dataset = parse70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @O1@ OBJE\n0 TRLR\n');
    const obj = dataset.records.find((record) => record.tag === 'OBJE') as { files: unknown[] };
    expect(obj?.files).toEqual([]);
  });

  test('OBJE must not carry a payload', () => {
    expect(err70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @O1@ OBJE text\n0 TRLR\n')).toBe('structure.unexpected-payload');
  });

  test('FILE without a FORM parses with form undefined', () => {
    const dataset = parse70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @O1@ OBJE\n1 FILE a.jpg\n0 TRLR\n');
    const obj = dataset.records.find((record) => record.tag === 'OBJE') as { files: Array<{ payload: string; form?: unknown }> };
    expect(obj?.files).toEqual([{ payload: 'a.jpg' }]);
    const dataset551 = parse551([...H551, '0 @O1@ OBJE', '1 FILE a.jpg', ...SUBM, '0 TRLR'].join('\n'));
    const obj551 = dataset551.records.find((record) => record.tag === 'OBJE') as { files: Array<{ payload: string; form?: unknown }> };
    expect(obj551?.files).toEqual([{ payload: 'a.jpg' }]);
  });

  test('a second FORM under FILE keeps the first occurrence', () => {
    const dataset = parse70(
      '0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @O1@ OBJE\n1 FILE a.jpg\n2 FORM image/jpeg\n2 FORM image/png\n0 TRLR\n',
    );
    const obj = dataset.records.find((record) => record.tag === 'OBJE') as {
      files: Array<{ payload: string; form: { payload: string } }>;
    };
    expect(obj?.files).toEqual([{ payload: 'a.jpg', form: { payload: 'image/jpeg' } }]);
  });

  test('a second FORM under TRAN keeps the first occurrence; TRAN requires a FORM', () => {
    const dataset = parse70(
      '0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @O1@ OBJE\n1 FILE a.jpg\n2 FORM image/jpeg\n2 TRAN en\n3 FORM image/jpeg\n3 FORM image/png\n0 TRLR\n',
    );
    const obj = dataset.records.find((record) => record.tag === 'OBJE') as {
      files: Array<{ payload: string; form: { payload: string }; translations?: Array<{ payload: string; form: { payload: string } }> }>;
    };
    expect(obj?.files?.[0]?.translations?.[0]).toEqual({ payload: 'en', form: { payload: 'image/jpeg' } });
    expect(
      err70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @O1@ OBJE\n1 FILE a.jpg\n2 FORM image/jpeg\n2 TRAN en\n0 TRLR\n'),
    ).toBe('structure.missing-required');
  });

  test('the TYPE accepts the PHRASE child and any FORM text', () => {
    const withPhrase = parse551(
      [...H551, '0 @O1@ OBJE', '1 FILE a.jpg', '2 FORM jpg', '3 TYPE PHOTO', '4 PHRASE x', ...SUBM, '0 TRLR'].join('\n'),
    );
    const obj = withPhrase.records.find((record) => record.tag === 'OBJE');
    expect(
      (obj as unknown as { files?: Array<{ form?: { medium?: { payload?: string; phrase?: string } } }> }).files?.[0]
        ?.form?.medium,
    ).toMatchObject({ payload: 'PHOTO', phrase: 'x' });
    const exe = parse551([...H551, '0 @O1@ OBJE', '1 FILE a.jpg', '2 FORM exe', ...SUBM, '0 TRLR'].join('\n'));
    const exeObj = exe.records.find((record) => record.tag === 'OBJE');
    expect((exeObj as unknown as { files?: Array<{ form?: { payload?: string } }> }).files?.[0]?.form?.payload).toBe('exe');
  });

  test('keeps unknown tags under OBJE as generic extensions', () => {
    const dataset = parse70(
      '0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @O1@ OBJE\n1 FILE a.jpg\n2 FORM jpg\n1 BOGUS x\n0 TRLR\n',
    );
    const obj = dataset.records.find((record) => record.tag === 'OBJE');
    expect(obj?.extensions?.some((extension) => extension.tag === 'BOGUS')).toBe(true);
  });
});

describe('submitter and submission records', () => {
  test('7.0 SUBM parses contacts, identifiers and details', () => {
    const dataset = parse70(
      [
        '0 HEAD', '1 GEDC', '2 VERS 7.0',
        '0 @S1@ SUBM',
        '1 NAME Tester',
        '1 ADDR Main St',
        '2 ADR1 1 Main St',
        '2 ADR2 Floor 2',
        '2 ADR3 Suite 3',
        '2 CITY Berlin',
        '2 STAE BE',
        '2 POST 10115',
        '2 CTRY DE',
        '2 _EMAIL mail@example.com',
        '2 _PRIV Y',
        '2 _NAME The Office',
        '1 PHON +49 1',
        '1 EMAIL a@example.com',
        '1 FAX +49 2',
        '1 WWW https://example.com',
        '1 LANG de',
        '1 LANG en',
        '1 OBJE @O1@',
        '1 NOTE a note',
        '1 CHAN',
        '2 DATE 4 JAN 2001',
        '1 CREA',
        '2 DATE 5 JAN 2001',
        '1 UID 550e',
        '1 _UID legacy',
        '1 EXID https://example.com/s1',
        '2 TYPE https://example.com/t',
        '1 REFN r1',
        '0 @O1@ OBJE',
        '1 FILE a.jpg',
        '2 FORM image/jpeg',
        '0 TRLR',
      ].join('\n'),
    );
    const rec = dataset.records[0] as {
      tag: 'SUBM'; name: string; address?: { payload: string; line1?: string; line2?: string; line3?: string; city?: string; state?: string; postalCode?: string; country?: string; email?: string[]; private?: boolean; name?: string };
      phone?: string[]; email?: string[]; fax?: string[]; www?: string[];
      media?: unknown[]; languages?: string[]; identifiers?: Array<{ tag: string; payload: string; type?: string }>;
      notes?: unknown[]; changeDate?: unknown; creationDate?: unknown;
    };
    expect(rec.name).toBe('Tester');
    expect(rec.address?.line1).toBe('1 Main St');
    expect(rec.address?.line2).toBe('Floor 2');
    expect(rec.address?.line3).toBe('Suite 3');
    expect(rec.address?.city).toBe('Berlin');
    expect(rec.address?.state).toBe('BE');
    expect(rec.address?.postalCode).toBe('10115');
    expect(rec.address?.country).toBe('DE');
    // The record-level contacts are relocated into the address block
    // (the canonical position).
    expect(rec.address?.email).toEqual(['mail@example.com', 'a@example.com']);
    expect(rec.address?.private).toBe(true);
    expect(rec.address?.name).toBe('The Office');
    expect(rec.phone).toBeUndefined();
    expect((rec.address as { phone?: string[] }).phone).toEqual(['+49 1']);
    expect(rec.email).toBeUndefined();
    expect((rec.address as { fax?: string[] }).fax).toEqual(['+49 2']);
    expect((rec.address as { www?: string[] }).www).toEqual(['https://example.com']);
    expect(rec.languages).toEqual(['de', 'en']);
    expect(rec.media).toHaveLength(1);
    expect(rec.notes).toHaveLength(1);
    expect(rec.changeDate).toBeDefined();
    expect(rec.creationDate).toBeDefined();
    expect(rec.identifiers?.map((id) => id.tag)).toEqual(['UID', 'UID', 'EXID', 'REFN']);
  });

  test('5.5.1 SUBM keeps contacts inside ADDR and parses RFN/RIN', () => {
    const dataset = parse551(
      [
        ...H551,
        '0 @S1@ SUBM',
        '1 NAME Tester',
        '1 ADDR Main St',
        '2 ADR1 1 Main St',
        '2 ADR2 F2',
        '2 ADR3 S3',
        '2 CITY Berlin',
        '2 STAE BE',
        '2 POST 10115',
        '2 CTRY DE',
        '2 PHON +49 1',
        '2 EMAIL a@@example.com',
        '2 FAX +49 2',
        '2 WWW https://example.com',
        '1 LANG English',
        '1 OBJE @O1@',
        '1 NOTE a note',
        '1 CHAN',
        '2 DATE 4 JAN 2001',
        '1 REFN r1',
        '1 RFN 99',
        '1 RIN 42',
        '1 _UID legacy',
        '0 @O1@ OBJE',
        '1 FILE a.jpg',
        '2 FORM jpg',
        '0 TRLR',
      ].join('\n'),
    );
    const rec = dataset.records[0] as {
      tag: 'SUBM'; address?: { payload: string; phone?: string[]; email?: string[]; fax?: string[]; www?: string[]; line1?: string; line2?: string; line3?: string; city?: string; state?: string; postalCode?: string; country?: string };
      languages?: string[]; media?: unknown[]; notes?: unknown[]; changeDate?: unknown;
      identifiers?: Array<{ tag: string; payload: string }>; registeredRfn?: string; automatedRecordId?: string;
    };
    expect(rec.address?.phone).toEqual(['+49 1']);
    expect(rec.address?.email).toEqual(['a@example.com']);
    expect(rec.address?.fax).toEqual(['+49 2']);
    expect(rec.address?.www).toEqual(['https://example.com']);
    expect(rec.address?.line1).toBe('1 Main St');
    expect(rec.address?.line2).toBe('F2');
    expect(rec.address?.line3).toBe('S3');
    expect(rec.address?.city).toBe('Berlin');
    expect(rec.address?.state).toBe('BE');
    expect(rec.address?.postalCode).toBe('10115');
    expect(rec.address?.country).toBe('DE');
    expect(rec.languages).toEqual(['English']);
    expect(rec.media).toHaveLength(1);
    expect(rec.notes).toHaveLength(1);
    expect(rec.changeDate).toBeDefined();
    expect(rec.identifiers?.map((id) => id.tag)).toEqual(['REFN', 'UID']);
    expect(rec.registeredRfn).toBe('99');
    expect(rec.automatedRecordId).toBe('42');
  });

  test('5.5.1 SUBM accepts the floating ADDRESS_STRUCTURE contacts beside ADDR', () => {
    const dataset = parse551(
      [
        ...H551,
        '0 @S1@ SUBM',
        '1 NAME Tester',
        '1 PHON +49 1',
        '1 PHON +49 2',
        '1 EMAIL a@@example.com',
        '1 FAX +49 3',
        '1 WWW https://example.com',
        '0 TRLR',
      ].join('\n'),
    );
    const rec = dataset.records[0] as {
      tag: 'SUBM'; phone?: string[]; email?: string[]; fax?: string[]; www?: string[];
    };
    expect(rec.phone).toEqual(['+49 1', '+49 2']);
    expect(rec.email).toEqual(['a@example.com']);
    expect(rec.fax).toEqual(['+49 3']);
    expect(rec.www).toEqual(['https://example.com']);
  });

  test('any number of SUBM record-level contacts', () => {
    const result = parseGedcom551(
      enc(
        [
          ...H551,
          '0 @S1@ SUBM',
          '1 NAME T',
          '1 PHON 1',
          '1 PHON 2',
          '1 PHON 3',
          '1 PHON 4',
          '0 TRLR',
        ].join('\n'),
      ),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const sub = result.value.records.find((record) => record.tag === 'SUBM');
      expect((sub as unknown as { phone?: string[] }).phone).toEqual(['1', '2', '3', '4']);
    }
  });

  test('any number of LANG/PHON substructures', () => {
    const result = parseGedcom551(
      enc(
        [
          ...H551,
          '0 @S1@ SUBM',
          '1 NAME T',
          '1 LANG English',
          '1 LANG Russian',
          '1 LANG German',
          '1 LANG French',
          '0 TRLR',
        ].join('\n'),
      ),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const sub = result.value.records.find((record) => record.tag === 'SUBM');
      expect((sub as unknown as { languages?: string[] }).languages).toEqual(['English', 'Russian', 'German', 'French']);
    }
    const contacts = parseGedcom551(
      enc(
        [
          ...H551,
          '0 @S1@ SUBM',
          '1 NAME T',
          '1 ADDR x',
          '2 PHON 1',
          '2 PHON 2',
          '2 PHON 3',
          '2 PHON 4',
          '0 TRLR',
        ].join('\n'),
      ),
    );
    expect(contacts.ok).toBe(true);
    if (contacts.ok) {
      const sub = contacts.value.records.find((record) => record.tag === 'SUBM');
      expect((sub as unknown as { address?: { phone?: string[] } }).address?.phone).toEqual(['1', '2', '3', '4']);
    }
  });

  test('a duplicate ADDR under SUBM keeps the first occurrence', () => {
    const dataset = parse70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @S1@ SUBM\n1 NAME T\n1 ADDR a\n1 ADDR b\n0 TRLR\n');
    const sub = dataset.records.find((record) => record.tag === 'SUBM') as { address?: { payload?: string } };
    expect(sub?.address?.payload).toBe('a');
  });

  test('a SUBM without a NAME is dropped as a bookkeeping-only record', () => {
    const dataset = parse70(
      [
        '0 HEAD',
        '1 GEDC',
        '2 VERS 7.0',
        '1 SUBM @U1@',
        '0 @U1@ SUBM',
        '1 _UID 6D7E370A1DC5DB4C9047087E1FBF17981F59',
        '1 CHAN',
        '2 DATE 27 AUG 2024',
        '0 @U2@ SUBM',
        '1 NAME Test Submitter',
        '0 TRLR',
      ].join('\n'),
    );
    const submitters = dataset.records.filter((record) => record.tag === 'SUBM');
    expect(submitters).toHaveLength(1);
    expect((submitters[0] as { xref?: string }).xref).toBe('@U2@');
    // The header pointer at the dropped record is reset — a dangling
    // pointer must not serialize back.
    expect(dataset.header.submitter).toBeUndefined();
  });

  test('SUBN parses all fields and validates ORDI', () => {
    const dataset = parse551(
      [
        ...H551,
        '1 SUBN @N1@',
        '0 @N1@ SUBN',
        '1 SUBM @S1@',
        '1 FAMF My Family',
        '1 TEMP SLAKE',
        '1 ANCE 10',
        '1 DESC 3',
        '1 ORDI yes',
        '1 RIN 7',
        '1 NOTE a note',
        '1 CHAN',
        '2 DATE 4 JAN 2001',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    expect(dataset.submission?.submitter).toBe('@S1@');
    expect(dataset.submission?.familyFile).toBe('My Family');
    expect(dataset.submission?.temple).toBe('SLAKE');
    expect(dataset.submission?.generationsOfAncestors).toBe(10);
    expect(dataset.submission?.generationsOfDescendants).toBe(3);
    expect(dataset.submission?.ordinanceProcessFlag).toBe('yes');
    expect(dataset.submission?.automatedRecordId).toBe('7');
    expect(dataset.submission?.notes).toHaveLength(1);
    expect(dataset.submission?.changeDate).toBeDefined();
  });

  test('ORDI must be yes or no', () => {
    expect(
      err551([...H551, '0 @N1@ SUBN', '1 ORDI maybe', ...SUBM, '0 TRLR'].join('\n').replace('0 @N1@ SUBN', '0 @N1@ SUBN')),
    ).toBe('enum.invalid-value');
    // The no variant normalizes to 'no'.
    const dataset = parse551(
      [
        '0 HEAD', '1 SOUR PAF', '1 SUBM @S1@', '1 SUBN @N1@', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8',
        '0 @N1@ SUBN', '1 ORDI NO',
        '0 @S1@ SUBM', '1 NAME T',
        '0 TRLR',
      ].join('\n'),
    );
    expect(dataset.submission?.ordinanceProcessFlag).toBe('no');
  });

  test('ANCE requires digits', () => {
    // The stray text is stripped by the dispatch retry; the payload-less
    // ANCE line then fails its required value.
    expect(
      err551(['0 HEAD', '1 SOUR PAF', '1 SUBM @S1@', '1 SUBN @N1@', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8', '0 @N1@ SUBN', '1 ANCE ten', '0 @S1@ SUBM', '1 NAME T', '0 TRLR'].join('\n')),
    ).toBe('structure.missing-payload');
  });
});

describe('repository, note and source records', () => {
  test('7.0 REPO parses every field', () => {
    const dataset = parse70(
      [
        '0 HEAD', '1 GEDC', '2 VERS 7.0',
        '0 @R1@ REPO',
        '1 NAME The Archive',
        '1 ADDR Main St',
        '1 PHON +49 1',
        '1 EMAIL a@example.com',
        '1 FAX +49 2',
        '1 WWW https://example.com',
        '1 NOTE a note',
        '1 CHAN',
        '2 DATE 4 JAN 2001',
        '1 CREA',
        '2 DATE 5 JAN 2001',
        '1 UID 550e',
        '1 _UID legacy',
        '1 EXID https://example.com/r1',
        '1 REFN r1',
        '0 TRLR',
      ].join('\n'),
    );
    const rec = dataset.records[0] as {
      tag: 'REPO'; name: string; address?: { payload: string }; phone?: string[]; email?: string[]; fax?: string[]; www?: string[];
      notes?: unknown[]; changeDate?: unknown; creationDate?: unknown; identifiers?: Array<{ tag: string }>;
    };
    expect(rec.name).toBe('The Archive');
    expect(rec.address?.payload).toBe('Main St');
    // The record-level contacts are relocated into the address block
    // (the canonical position).
    expect(rec.phone).toBeUndefined();
    expect((rec.address as { phone?: string[] }).phone).toEqual(['+49 1']);
    expect(rec.notes).toHaveLength(1);
    expect(rec.changeDate).toBeDefined();
    expect(rec.creationDate).toBeDefined();
    expect(rec.identifiers?.map((id) => id.tag)).toEqual(['UID', 'UID', 'EXID', 'REFN']);
  });

  test('5.5.1 REPO parses RIN and _UID; a missing NAME becomes the empty name', () => {
    const dataset = parse551(
      [...H551, '0 @R1@ REPO', '1 NAME A', '1 ADDR x', '1 NOTE n', '1 CHAN', '2 DATE 4 JAN 2001', '1 REFN r1', '1 RIN 3', '1 _UID u', ...SUBM, '0 TRLR'].join('\n'),
    );
    const rec = dataset.records[0] as {
      tag: 'REPO'; name: string; identifiers?: Array<{ tag: string }>; automatedRecordId?: string; notes?: unknown[]; changeDate?: unknown; address?: unknown;
    };
    expect(rec.name).toBe('A');
    expect(rec.identifiers?.map((id) => id.tag)).toEqual(['REFN', 'UID']);
    expect(rec.automatedRecordId).toBe('3');
    expect(rec.notes).toHaveLength(1);
    expect(rec.changeDate).toBeDefined();
    expect(rec.address).toBeDefined();
    const nameless = parse551([...H551, '0 @R1@ REPO', '1 NOTE n', ...SUBM, '0 TRLR'].join('\n'));
    const namelessRec = nameless.records.find((record) => record.tag === 'REPO') as { name: string };
    expect(namelessRec?.name).toBe('');
  });

  test('5.5.1 REPO accepts the floating ADDRESS_STRUCTURE contacts beside ADDR', () => {
    const dataset = parse551(
      [...H551, '0 @R1@ REPO', '1 NAME A', '1 PHON +49 1', '1 EMAIL a@@example.com', '1 FAX +49 2', '1 WWW https://example.com', ...SUBM, '0 TRLR'].join('\n'),
    );
    const rec = dataset.records[0] as {
      tag: 'REPO'; phone?: string[]; email?: string[]; fax?: string[]; www?: string[];
    };
    expect(rec.phone).toEqual(['+49 1']);
    expect(rec.email).toEqual(['a@example.com']);
    expect(rec.fax).toEqual(['+49 2']);
    expect(rec.www).toEqual(['https://example.com']);
  });

  test('7.0 SNOTE record parses every field', () => {
    const dataset = parse70(
      [
        '0 HEAD', '1 GEDC', '2 VERS 7.0',
        '0 @N1@ SNOTE the text',
        '1 MIME text/plain',
        '1 LANG en',
        '1 TRAN de',
        '2 MIME text/plain',
        '2 LANG de',
        '1 SOUR @S2@',
        '1 CHAN',
        '2 DATE 4 JAN 2001',
        '1 CREA',
        '2 DATE 5 JAN 2001',
        '1 REFN r1',
        '1 UID 550e',
        '1 EXID https://example.com/n1',
        '0 @S2@ SOUR',
        '1 TITL S',
        '0 TRLR',
      ].join('\n'),
    );
    const rec = dataset.records[0] as {
      tag: 'SNOTE'; payload: string; mediaType?: string; language?: string;
      translations?: Array<{ payload: string; mediaType?: string; language?: string }>;
      citations?: unknown[]; changeDate?: unknown; creationDate?: unknown; identifiers?: Array<{ tag: string }>;
    };
    expect(rec.payload).toBe('the text');
    expect(rec.mediaType).toBe('text/plain');
    expect(rec.language).toBe('en');
    expect(rec.translations?.[0]).toEqual({ payload: 'de', mediaType: 'text/plain', language: 'de' });
    expect(rec.citations).toHaveLength(1);
    expect(rec.changeDate).toBeDefined();
    expect(rec.creationDate).toBeDefined();
    expect(rec.identifiers?.map((id) => id.tag)).toEqual(['REFN', 'UID', 'EXID']);
  });

  test('5.5.1 NOTE record parses every field', () => {
    const dataset = parse551(
      [...H551, '0 @N1@ NOTE the text', '1 SOUR @S2@', '1 CHAN', '2 DATE 4 JAN 2001', '1 REFN r1', '1 RIN 2', '1 _UID u', ...SUBM, '0 @S2@ SOUR', '1 TITL S', '0 TRLR'].join('\n'),
    );
    const rec = dataset.records[0] as {
      tag: 'NOTE'; payload: string; citations?: unknown[]; changeDate?: unknown; identifiers?: Array<{ tag: string }>; automatedRecordId?: string;
    };
    expect(rec.payload).toBe('the text');
    expect(rec.citations).toHaveLength(1);
    expect(rec.changeDate).toBeDefined();
    expect(rec.identifiers?.map((id) => id.tag)).toEqual(['REFN', 'UID']);
    expect(rec.automatedRecordId).toBe('2');
  });

  test('7.0 SOUR record parses DATA, TEXT, _TMPLT, REPO and identifiers', () => {
    const dataset = parse70(
      [
        '0 HEAD', '1 GEDC', '2 VERS 7.0',
        '0 @S1@ SOUR',
        '1 DATA',
        '2 EVEN BIRT, DEAT',
        '3 DATE FROM 1900 TO 1910',
        '4 PHRASE approx',
        '3 PLAC Paris',
        '2 AGNC The Agency',
        '2 NOTE data note',
        '1 AUTH John Doe',
        '1 TITL The Title',
        '1 ABBR TT',
        '1 PUBL Pub Co',
        '1 TEXT the transcript',
        '2 MIME text/plain',
        '2 LANG en',
        '1 _TMPLT',
        '2 TID 123',
        '2 FIELD',
        '3 NAME Author',
        '3 VALUE John',
        '1 _FULL the footnote',
        '1 REPO @R1@',
        '2 CALN A-1',
        '3 MEDI BOOK',
        '2 NOTE repo note',
        '1 NOTE a note',
        '1 OBJE @O1@',
        '1 CHAN',
        '2 DATE 4 JAN 2001',
        '1 CREA',
        '2 DATE 5 JAN 2001',
        '1 REFN r1',
        '1 UID 550e',
        '1 EXID https://example.com/s1',
        '0 @R1@ REPO',
        '1 NAME R',
        '0 @O1@ OBJE',
        '1 FILE a.jpg',
        '2 FORM image/jpeg',
        '0 TRLR',
      ].join('\n'),
    );
    const rec = dataset.records[0] as {
      tag: 'SOUR';
      data?: { events?: Array<{ payload: string[]; date?: { value?: unknown; phrase?: string }; place?: { payload: string[] } }>; agency?: string; notes?: unknown[] };
      author?: string; title?: string; abbreviation?: string; publication?: string;
      text?: { payload: string; mediaType?: string; language?: string };
      template?: { templateId?: string; fields: Array<{ name: string; value?: string }> };
      fullFootnote?: string;
      repositoryCitations?: Array<{ repository: string; notes?: unknown[]; callNumbers?: Array<{ payload: string; medium?: { payload: string } }> }>;
      notes?: unknown[]; media?: unknown[]; changeDate?: unknown; creationDate?: unknown; identifiers?: Array<{ tag: string }>;
    };
    expect(rec.data?.events?.[0]?.payload).toEqual(['BIRT', 'DEAT']);
    expect(rec.data?.events?.[0]?.date?.value).toEqual({ kind: 'period', from: { calendar: 'GREGORIAN', year: 1900 }, to: { calendar: 'GREGORIAN', year: 1910 } });
    expect(rec.data?.events?.[0]?.date?.phrase).toBe('approx');
    expect(rec.data?.events?.[0]?.place?.payload).toEqual(['Paris']);
    expect(rec.data?.agency).toBe('The Agency');
    expect(rec.data?.notes).toHaveLength(1);
    expect(rec.author).toBe('John Doe');
    expect(rec.title).toBe('The Title');
    expect(rec.abbreviation).toBe('TT');
    expect(rec.publication).toBe('Pub Co');
    expect(rec.text).toEqual({ payload: 'the transcript', mediaType: 'text/plain', language: 'en' });
    expect(rec.template).toEqual({ tag: '_TMPLT', templateId: '123', fields: [{ tag: 'FIELD', name: 'Author', value: 'John' }] });
    expect(rec.fullFootnote).toBe('the footnote');
    expect(rec.repositoryCitations?.[0]?.repository).toBe('@R1@');
    expect(rec.repositoryCitations?.[0]?.callNumbers?.[0]).toEqual({ payload: 'A-1', medium: { payload: 'BOOK' } });
    expect(rec.repositoryCitations?.[0]?.notes).toHaveLength(1);
    expect(rec.notes).toHaveLength(1);
    expect(rec.media).toHaveLength(1);
    expect(rec.changeDate).toBeDefined();
    expect(rec.creationDate).toBeDefined();
    expect(rec.identifiers?.map((id) => id.tag)).toEqual(['REFN', 'UID', 'EXID']);
  });

  test('5.5.1 SOUR record parses DATA, TEXT, _TMPLT, REPO, RIN and _UID', () => {
    const dataset = parse551(
      [
        ...H551,
        '0 @S2@ SOUR',
        '1 DATA',
        '2 EVEN BIRT',
        '3 DATE FROM 1900 TO 1910',
        '3 PLAC Paris',
        '2 AGNC The Agency',
        '2 NOTE data note',
        '1 AUTH John Doe',
        '1 TITL The Title',
        '1 ABBR TT',
        '1 PUBL Pub Co',
        '1 TEXT the transcript',
        '1 _TMPLT',
        '2 TID 123',
        '2 FIELD',
        '3 NAME Author',
        '3 VALUE John',
        '1 _FULL the footnote',
        '1 REPO @R1@',
        '2 CALN A-1',
        '3 MEDI book',
        '1 NOTE a note',
        '1 OBJE @O1@',
        '1 CHAN',
        '2 DATE 4 JAN 2001',
        '1 REFN r1',
        '1 RIN 2',
        '1 _UID u',
        ...SUBM,
        '0 @R1@ REPO',
        '1 NAME R',
        '0 @O1@ OBJE',
        '1 FILE a.jpg',
        '2 FORM jpg',
        '0 TRLR',
      ].join('\n'),
    );
    const rec = dataset.records[0] as {
      tag: 'SOUR';
      data?: { events?: Array<{ payload: string[]; date?: { value?: unknown }; place?: { payload: string[] } }>; agency?: string; notes?: unknown[] };
      author?: string; title?: string; abbreviation?: string; publication?: string;
      text?: { payload: string };
      template?: { templateId?: string; fields: Array<{ name: string; value?: string }> };
      fullFootnote?: string;
      repositoryCitations?: Array<{ repository: string; callNumbers?: Array<{ payload: string; medium?: { payload: string } }> }>;
      notes?: unknown[]; media?: unknown[]; changeDate?: unknown; identifiers?: Array<{ tag: string }>; automatedRecordId?: string;
    };
    expect(rec.data?.events?.[0]?.date?.value).toEqual({ kind: 'period', from: { calendar: 'GREGORIAN', year: 1900 }, to: { calendar: 'GREGORIAN', year: 1910 } });
    expect(rec.data?.events?.[0]?.place?.payload).toEqual(['Paris']);
    expect(rec.data?.agency).toBe('The Agency');
    expect(rec.data?.notes).toHaveLength(1);
    expect(rec.author).toBe('John Doe');
    expect(rec.title).toBe('The Title');
    expect(rec.abbreviation).toBe('TT');
    expect(rec.publication).toBe('Pub Co');
    expect(rec.text?.payload).toBe('the transcript');
    expect(rec.template).toEqual({ tag: '_TMPLT', templateId: '123', fields: [{ tag: 'FIELD', name: 'Author', value: 'John' }] });
    expect(rec.fullFootnote).toBe('the footnote');
    expect(rec.repositoryCitations?.[0]?.repository).toBe('@R1@');
    expect(rec.repositoryCitations?.[0]?.callNumbers?.[0]?.medium?.payload).toBe('BOOK');
    expect(rec.notes).toHaveLength(1);
    expect(rec.media).toHaveLength(1);
    expect(rec.changeDate).toBeDefined();
    expect(rec.identifiers?.map((id) => id.tag)).toEqual(['REFN', 'UID']);
    expect(rec.automatedRecordId).toBe('2');
  });

  test('5.5.1 DATA.EVEN.PLAC accepts the GEDCOM-L place children', () => {
    // The GEDCOM-L place tags under the SOUR.DATA.EVEN.PLAC jurisdiction
    // place (webtrees per-vendor custom-tag registry, GedcomL.php) parse
    // into the typed PlaceStructure slots instead of failing.
    const dataset = parse551([...H551, '0 @S2@ SOUR', '1 DATA', '2 EVEN BIRT', '3 PLAC Paris', '4 _GOV WEIHEN_W6051', ...SUBM, '0 TRLR'].join('\n'));
    const data = dataset.records.find((r): r is { tag: 'SOUR'; data?: { events?: Array<{ place?: { govId?: string } }> } } => r.tag === 'SOUR');
    expect(data?.data?.events?.[0]?.place?.govId).toBe('WEIHEN_W6051');
  });

  test('_TMPLT FIELD without a NAME gets the empty name; unknown tags under TEXT become extensions', () => {
    const templ = parse70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @S1@ SOUR\n1 _TMPLT\n2 FIELD\n3 VALUE v\n0 TRLR\n');
    const sour = templ.records.find((record) => record.tag === 'SOUR') as { template?: { fields?: Array<{ name: string }> } };
    expect(sour?.template?.fields?.[0]?.name).toBe('');
    const dataset = parse70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @S1@ SOUR\n1 TEXT t\n2 BOGUS x\n0 TRLR\n');
    const sour2 = dataset.records.find((record) => record.tag === 'SOUR') as { text?: { extensions?: Array<{ tag: string }> } };
    expect(sour2?.text?.extensions?.some((extension) => extension.tag === 'BOGUS')).toBe(true);
  });

  test('a SOUR record payload becomes the title; a TITL child overrides it', () => {
    const payload = parse70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @S1@ SOUR payload\n0 TRLR\n');
    const sour = payload.records.find((record) => record.tag === 'SOUR') as { title?: string };
    expect(sour?.title).toBe('payload');
    const overridden = parse70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @S1@ SOUR payload\n1 TITL Real\n0 TRLR\n');
    const sour2 = overridden.records.find((record) => record.tag === 'SOUR') as { title?: string };
    expect(sour2?.title).toBe('Real');
  });
});
