import { describe, expect, it } from 'vitest';
import { parse, serializeGedcom70 } from '@doru/gedcom';
import { buildGedcomDataset } from '../src/export/gedcom';
import { importGedcomDataset } from '../src/import/gedcom';
import type { FactRecord, PersonRecord, SourceRecord } from '../src/model/types';
import { cleanupRepo, makeRepo } from './helpers';

describe('buildGedcomDataset', () => {
  it('exports an app-created shared note as an SNOTE record', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertSource({ id: 'S1', title: 'Parish register' });
      repo.insertNote({
        id: 'SN1',
        text: 'shared note',
        links: [
          { id: 'L1', targetType: 'person', targetId: 'P1' },
          { id: 'L2', targetType: 'person', targetId: 'P2' },
        ],
      });
      repo.addSourceCitation('S1', 'note', 'SN1');
      const dataset = buildGedcomDataset(repo);
      const note = dataset.records.find((record) => record.tag === 'SNOTE');
      expect(note).toEqual(
        expect.objectContaining({
          xref: '@N1@',
          payload: 'shared note',
          citations: [expect.objectContaining({ tag: 'SOUR' })],
        }),
      );
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('round-trips persons, facts, dates, families, sources, citations and notes', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      const source: SourceRecord = { id: 'S1', title: 'Parish register', author: 'Church' };
      const person: PersonRecord = {
        id: 'P1',
        names: [{ id: 'N1', given: 'Ivan', surname: 'Petrov', nickname: 'Vanya' }],
        sex: 'M',
        facts: [
          {
            id: 'B1',
            personId: 'P1',
            tag: 'BIRT',
            date: { quality: 'exact', component: { year: 1923, month: 3, day: 12 } },
            place: 'Moscow, Russia',
          },
          { id: 'D1', personId: 'P1', tag: 'DEAT', date: { quality: 'after', component: { year: 1990 } } },
          { id: 'O1', personId: 'P1', tag: 'OCCU', value: 'Engineer' },
          { id: 'X1', personId: 'P1', tag: '_MILT', value: '2nd regiment' },
        ],
      };
      const spouse: PersonRecord = { id: 'P2', names: [{ id: 'N2', given: 'Maria' }], sex: 'F', facts: [] };
      repo.insertPerson(person);
      repo.insertPerson(spouse);
      repo.insertFamily({ id: 'F1', partners: ['P1', 'P2'], children: [] });
      repo.insertSource(source);
      repo.addSourceCitation('S1', 'fact', 'B1');
      repo.insertNote({ id: 'NN1', text: 'inline note', targetType: 'person', targetId: 'P1' });

      const dataset = buildGedcomDataset(repo);
      const serialized = serializeGedcom70(dataset);
      expect(serialized.ok).toBe(true);
      if (!serialized.ok) {
        return;
      }
      const reparsed = parse(new TextEncoder().encode(serialized.value));
      expect(reparsed.ok).toBe(true);
      if (!reparsed.ok || reparsed.value.kind !== 'dataset') {
        return;
      }

      const target = makeRepo();
      try {
        importGedcomDataset(reparsed.value.dataset, target.repo);
        const persons = target.repo.listAllPersons();
        expect(persons).toHaveLength(2);
        const ivan = persons.find((entry) => entry.names[0]?.given === 'Ivan');
        expect(ivan?.sex).toBe('M');
        expect(ivan?.names[0]).toEqual(
          expect.objectContaining({ given: 'Ivan', surname: 'Petrov', nickname: 'Vanya' }),
        );
        expect(ivan?.facts.find((fact) => fact.tag === 'BIRT')?.date).toEqual({
          id: expect.any(String),
          quality: 'exact',
          component: { year: 1923, month: 3, day: 12 },
        });
        expect(ivan?.facts.find((fact) => fact.tag === 'BIRT')?.place).toBe('Moscow, Russia');
        expect(ivan?.facts.find((fact) => fact.tag === 'DEAT')?.date).toEqual({
          id: expect.any(String),
          quality: 'after',
          component: { year: 1990 },
        });
        expect(ivan?.facts.find((fact) => fact.tag === 'OCCU')?.value).toBe('Engineer');
        // Unknown tags project onto EVEN with the tag in TYPE.
        const custom = ivan?.facts.find((fact) => fact.tag === 'EVEN' && fact.type === '_MILT');
        expect(custom?.value).toBe('2nd regiment');

        const families = target.repo.listFamilies();
        expect(families).toHaveLength(1);
        expect(families[0]?.partners).toEqual([
          persons.find((entry) => entry.names[0]?.given === 'Ivan')?.id,
          persons.find((entry) => entry.names[0]?.given === 'Maria')?.id,
        ]);

        expect(target.repo.listSources()).toEqual([
          expect.objectContaining({ title: 'Parish register', author: 'Church' }),
        ]);
        expect(target.repo.listNotesFor('person', ivan?.id ?? '')).toEqual([
          expect.objectContaining({ text: 'inline note' }),
        ]);
      } finally {
        cleanupRepo(target);
      }
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('assigns fresh xrefs to records without one and keeps imported ones', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertPerson({ id: 'P1', xref: '@I7@', names: [], sex: 'U', facts: [] });
      repo.insertPerson({ id: 'P2', names: [], sex: 'U', facts: [] });
      repo.insertFamily({ id: 'F1', partners: ['P1', 'P2'], children: [] });
      repo.insertSource({ id: 'S1', title: 'Book' });

      const dataset = buildGedcomDataset(repo);
      const xrefs = dataset.records.map((record) => record.xref).filter((xref) => xref !== undefined);
      // The imported @I7@ survives; fresh xrefs avoid collisions with it.
      expect(xrefs).toContain('@I7@');
      expect(xrefs).toHaveLength(4);
      expect(xrefs.filter((xref) => xref !== '@I7@').sort()).toEqual(['@F1@', '@I1@', '@S1@']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('skips over used xrefs when allocating fresh ones', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      repo.insertPerson({ id: 'P1', xref: '@I1@', names: [], sex: 'U', facts: [] });
      repo.insertPerson({ id: 'P2', names: [], sex: 'U', facts: [] });

      const dataset = buildGedcomDataset(repo);
      const xrefs = dataset.records.map((record) => record.xref);
      expect(xrefs).toContain('@I1@');
      // The fresh xref skipped the used @I1@.
      expect(xrefs).toContain('@I2@');
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('round-trips calendar, modifier and range dates', () => {
    const fixture = makeRepo();
    try {
      const { repo } = fixture;
      const facts: FactRecord[] = [
        {
          id: 'J1',
          personId: 'P1',
          tag: 'BIRT',
          date: { quality: 'exact', component: { calendar: 'julian', year: 1826, month: 1, day: 3 } },
        },
        {
          id: 'A1',
          personId: 'P1',
          tag: 'CHR',
          date: { quality: 'about', modifier: 'CAL', component: { year: 1826 } },
        },
        {
          id: 'R1',
          personId: 'P1',
          tag: 'RESI',
          date: { quality: 'range', component: { year: 1900 }, end: { year: 1905 } },
        },
        {
          id: 'T1',
          personId: 'P1',
          tag: 'BURI',
          date: { quality: 'unknown', text: 'after the war' },
        },
      ];
      repo.insertPerson({ id: 'P1', names: [{ id: 'N1', given: 'A' }], sex: 'U', facts });

      const dataset = buildGedcomDataset(repo);
      const serialized = serializeGedcom70(dataset);
      expect(serialized.ok).toBe(true);
      if (!serialized.ok) {
        return;
      }
      const reparsed = parse(new TextEncoder().encode(serialized.value));
      if (!reparsed.ok || reparsed.value.kind !== 'dataset') {
        throw new Error('reparse failed');
      }
      const target = makeRepo();
      try {
        importGedcomDataset(reparsed.value.dataset, target.repo);
        const person = target.repo.listAllPersons()[0];
        expect(person?.facts.find((fact) => fact.tag === 'BIRT')?.date).toEqual({
          id: expect.any(String),
          quality: 'exact',
          component: { calendar: 'julian', year: 1826, month: 1, day: 3 },
        });
        expect(person?.facts.find((fact) => fact.tag === 'CHR')?.date).toEqual({
          id: expect.any(String),
          quality: 'about',
          modifier: 'CAL',
          component: { year: 1826 },
        });
        expect(person?.facts.find((fact) => fact.tag === 'RESI')?.date).toEqual({
          id: expect.any(String),
          quality: 'range',
          component: { year: 1900 },
          end: { year: 1905 },
        });
        expect(person?.facts.find((fact) => fact.tag === 'BURI')?.date).toEqual({
          id: expect.any(String),
          quality: 'unknown',
          text: 'after the war',
        });
      } finally {
        cleanupRepo(target);
      }
    } finally {
      cleanupRepo(fixture);
    }
  });
});
