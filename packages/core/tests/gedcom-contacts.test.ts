import { describe, expect, it } from 'vitest';
import { parse, serializeGedcom551, serializeGedcom70, type GedcomDataset } from '@doru/gedcom';
import { buildGedcomDataset } from '../src/export/gedcom';
import { importGedcomDataset } from '../src/import/gedcom';
import { cleanupRepo, makeRepo } from './helpers';

const ADDRESS_CONTACTS_551 = [
  '0 HEAD',
  '1 GEDC',
  '2 VERS 5.5.1',
  '1 CHAR UTF-8',
  '0 @R1@ REPO',
  '1 NAME State Archive',
  '1 ADDR 1 Archive Lane',
  '2 CITY Springfield',
  '2 EMAIL repo@example.org',
  '2 PHON 111',
  '0 @U1@ SUBM',
  '1 NAME Test Submitter',
  '1 ADDR 2 Submitter Lane',
  '2 EMAIL submitter@example.org',
  '2 PHON 222',
  '0 @I1@ INDI',
  '1 NAME Ivan /Petrov/',
  '1 ADDR 3 Person Lane',
  '2 EMAIL person@example.org',
  '2 PHON 333',
  '1 BIRT',
  '2 DATE 1900',
  '2 ADDR 4 Fact Lane',
  '2 EMAIL fact@example.org',
  '2 PHON 444',
  '0 TRLR',
].join('\n');

function parseDataset(text: string): GedcomDataset {
  const parsed = parse(new TextEncoder().encode(text));
  if (!parsed.ok || parsed.value.kind !== 'dataset') {
    throw new Error('fixture failed to parse');
  }
  return parsed.value.dataset;
}

function contactPairs(contacts: Array<{ kind: string; value: string }>): Array<[string, string]> {
  return contacts.map((contact) => [contact.kind, contact.value] as [string, string]).sort();
}

describe('contact ownership', () => {
  it('hoists 5.5.1 address contacts onto their owning records', () => {
    const fixture = makeRepo();
    try {
      importGedcomDataset(parseDataset(ADDRESS_CONTACTS_551), fixture.repo);

      const repository = fixture.repo.listRepositories()[0]!;
      const submitter = fixture.repo.listSubmitters()[0]!;
      const person = fixture.repo.listAllPersons()[0]!;
      const birth = person.facts.find((fact) => fact.tag === 'BIRT')!;

      expect(contactPairs(fixture.repo.listContactsFor('repository', repository.id))).toEqual([
        ['email', 'repo@example.org'],
        ['phone', '111'],
      ]);
      expect(contactPairs(fixture.repo.listContactsFor('submitter', submitter.id))).toEqual([
        ['email', 'submitter@example.org'],
        ['phone', '222'],
      ]);
      expect(contactPairs(fixture.repo.listContactsFor('person', person.id))).toEqual([
        ['email', 'person@example.org'],
        ['phone', '333'],
      ]);
      expect(contactPairs(fixture.repo.listContactsFor('fact', birth.id))).toEqual([
        ['email', 'fact@example.org'],
        ['phone', '444'],
      ]);

      for (const addressId of [repository.addressId, submitter.addressId, person.addressId, birth.addressId]) {
        if (addressId !== undefined) {
          expect(fixture.repo.listContactsFor('address', addressId)).toEqual([]);
        }
      }
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('writes owner contacts inside ADDRESS for 5.5.1 and at the owner for 7.0', () => {
    const fixture = makeRepo();
    try {
      importGedcomDataset(parseDataset(ADDRESS_CONTACTS_551), fixture.repo);
      const dataset = buildGedcomDataset(fixture.repo);

      const serialized551 = serializeGedcom551(dataset);
      expect(serialized551.ok).toBe(true);
      if (!serialized551.ok) {
        return;
      }
      const round551 = parseDataset(serialized551.value);
      const repo551 = round551.records.find((record) => record.tag === 'REPO') as
        | { email?: string[]; address?: { email?: string[]; phone?: string[] } }
        | undefined;
      expect(repo551?.email).toBeUndefined();
      expect(repo551?.address?.email).toEqual(['repo@example.org']);
      expect(repo551?.address?.phone).toEqual(['111']);
      const person551 = round551.records.find((record) => record.tag === 'INDI')!;
      expect(person551.email).toEqual(['person@example.org']);
      expect(person551.address?.email).toBeUndefined();
      const birth551 = person551.events?.find((event) => event.tag === 'BIRT');
      expect(birth551?.detail?.email).toBeUndefined();
      expect(birth551?.detail?.address?.email).toEqual(['fact@example.org']);

      const serialized70 = serializeGedcom70(dataset);
      expect(serialized70.ok).toBe(true);
      if (!serialized70.ok) {
        return;
      }
      // The 7.0 parser canonicalizes direct contacts back into an address when
      // one exists, so inspect the wire text instead of the round-tripped model.
      expect(serialized70.value).toContain('1 EMAIL repo@example.org');
      expect(serialized70.value).not.toContain('2 EMAIL repo@example.org');
      expect(serialized70.value).toContain('1 EMAIL submitter@example.org');
      expect(serialized70.value).not.toContain('2 EMAIL submitter@example.org');
      expect(serialized70.value).toContain('2 EMAIL fact@example.org');
      expect(serialized70.value).not.toContain('3 EMAIL fact@example.org');
      const round70 = parseDataset(serialized70.value);
      const person70 = round70.records.find((record) => record.tag === 'INDI')!;
      expect(person70.address).toBeUndefined();
    } finally {
      cleanupRepo(fixture);
    }
  });
});

const DIRECT_CONTACTS = [
  '0 HEAD',
  '1 GEDC',
  '2 VERS 7.0',
  '0 @I1@ INDI',
  '1 NAME Ivan /Petrov/',
  '1 WWW https://person.example',
  '0 @R1@ REPO',
  '1 NAME State Archive',
  '1 WWW https://repo.example',
  '0 @U1@ SUBM',
  '1 NAME Test Submitter',
  '1 WWW https://submitter.example',
  '1 _SKYPEID ivan.skype',
  '1 _JABBERID ivan@jabber.example',
  '0 TRLR',
].join('\n');

describe('canonical website and handles', () => {
  it('imports direct websites as www and keeps submitter handles', () => {
    const fixture = makeRepo();
    try {
      importGedcomDataset(parseDataset(DIRECT_CONTACTS), fixture.repo);
      const person = fixture.repo.listAllPersons()[0]!;
      const repository = fixture.repo.listRepositories()[0]!;
      const submitter = fixture.repo.listSubmitters()[0]!;

      expect(contactPairs(fixture.repo.listContactsFor('person', person.id))).toEqual([
        ['www', 'https://person.example'],
      ]);
      expect(contactPairs(fixture.repo.listContactsFor('repository', repository.id))).toEqual([
        ['www', 'https://repo.example'],
      ]);
      expect(contactPairs(fixture.repo.listContactsFor('submitter', submitter.id))).toEqual([
        ['jabber', 'ivan@jabber.example'],
        ['skype', 'ivan.skype'],
        ['www', 'https://submitter.example'],
      ]);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('exports a person website as _URL and a submitter handle as _SKYPEID/_JABBERID', () => {
    const fixture = makeRepo();
    try {
      importGedcomDataset(parseDataset(DIRECT_CONTACTS), fixture.repo);
      const serialized = serializeGedcom70(buildGedcomDataset(fixture.repo));
      expect(serialized.ok).toBe(true);
      if (!serialized.ok) {
        return;
      }
      expect(serialized.value).toContain('1 _URL https://person.example');
      expect(serialized.value).toContain('1 _SKYPEID ivan.skype');
      expect(serialized.value).toContain('1 _JABBERID ivan@jabber.example');
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('treats a legacy url row as a website on export', () => {
    const fixture = makeRepo();
    try {
      fixture.repo.insertPerson({ id: 'P1', sex: 'U', names: [], facts: [] });
      fixture.repo.insertContact({
        id: 'C1',
        targetType: 'person',
        targetId: 'P1',
        kind: 'url',
        value: 'https://legacy.example',
      });
      const serialized = serializeGedcom70(buildGedcomDataset(fixture.repo));
      expect(serialized.ok).toBe(true);
      if (!serialized.ok) {
        return;
      }
      expect(serialized.value).toContain('1 _URL https://legacy.example');
    } finally {
      cleanupRepo(fixture);
    }
  });
});
