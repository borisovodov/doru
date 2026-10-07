import { describe, expect, it } from 'vitest';
import { ReadGedcomImporter } from '../src/gedcom/importer';
import { importGedcomOp } from '../src/ops/importGedcom';
import { cleanupRepo, makeRepo } from './helpers';

const gedcom = `0 HEAD
1 GEDC
2 VERS 5.5.1
0 @I1@ INDI
1 NAME Ivan /Ivanov/
1 SEX M
0 @I2@ INDI
1 NAME Maria /Ivanova/
1 SEX F
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
0 TRLR
`;

function importDoc() {
  const buffer = new TextEncoder().encode(gedcom).buffer as ArrayBuffer;
  return new ReadGedcomImporter().import(buffer);
}

describe('importGedcomOp', () => {
  it('inserts persons and families in one transaction and reports them', () => {
    const fixture = makeRepo();
    try {
      const op = importGedcomOp('user:import', 'royal92.ged', importDoc());
      op.apply({ repo: fixture.repo });

      expect(op.insertedPersons).toEqual(['@I1@', '@I2@']);
      expect(op.insertedFamilies).toEqual(['@F1@']);
      expect(fixture.repo.countPersons()).toBe(2);
      expect(fixture.repo.getFamily('@F1@')?.parents).toEqual(['@I1@', '@I2@']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('is fully reversible', () => {
    const fixture = makeRepo();
    try {
      const op = importGedcomOp('user:import', 'royal92.ged', importDoc());
      op.apply({ repo: fixture.repo });
      op.inverse({ repo: fixture.repo });

      expect(fixture.repo.countPersons()).toBe(0);
      expect(fixture.repo.listFamilies()).toEqual([]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('skips already existing records and only removes what it inserted', () => {
    const fixture = makeRepo();
    try {
      const op = importGedcomOp('user:import', 'royal92.ged', importDoc());
      op.apply({ repo: fixture.repo });

      const again = importGedcomOp('user:import', 'royal92.ged', importDoc());
      again.apply({ repo: fixture.repo });
      expect(again.insertedPersons).toEqual([]);

      again.inverse({ repo: fixture.repo });
      expect(fixture.repo.countPersons()).toBe(2);
      expect(fixture.repo.listFamilies()).toHaveLength(1);
    } finally {
      cleanupRepo(fixture);
    }
  });
});
