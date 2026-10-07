import { readGedcom, type TreeNode } from 'read-gedcom';
import {
  emptyDocument,
  type DateValue,
  type PersonRecord,
  type Sex,
  type TreeDocument,
} from '../model/types';

export interface GedcomImporter {
  import(buffer: ArrayBuffer): TreeDocument;
}

type SelectionGedcom = ReturnType<typeof readGedcom>;

export class ReadGedcomImporter implements GedcomImporter {
  import(buffer: ArrayBuffer): TreeDocument {
    const doc = emptyDocument();
    const root = readGedcom(buffer);
    this.importIndividuals(root, doc);
    this.importFamilies(root, doc);
    return doc;
  }

  private importIndividuals(root: SelectionGedcom, doc: TreeDocument): void {
    const individuals = root.getIndividualRecord();
    for (let i = 0; i < individuals.length; i++) {
      const node = individuals[i];
      if (!node) {
        continue;
      }
      const id = node.pointer ?? `#${i}`;
      const nameNode = node.children.find((child) => child.tag === 'NAME');
      const sexNode = node.children.find((child) => child.tag === 'SEX');
      const birthNode = node.children.find((child) => child.tag === 'BIRT');

      const sexValue = sexNode?.value;
      const person: PersonRecord = {
        id,
        names: nameNode?.value ? [{ full: nameNode.value }] : [],
        sex: sexValue === 'M' || sexValue === 'F' ? (sexValue as Sex) : 'U',
        birth: birthNode ? this.dateFrom(birthNode) : undefined,
      };
      doc.persons.set(id, person);
    }
  }

  private importFamilies(root: SelectionGedcom, doc: TreeDocument): void {
    const families = root.getFamilyRecord();
    for (let i = 0; i < families.length; i++) {
      const node = families[i];
      if (!node) {
        continue;
      }
      const id = node.pointer ?? `#F${i}`;
      const parents: string[] = [];
      const children: string[] = [];
      for (const child of node.children) {
        const value = child.value;
        if (!value) {
          continue;
        }
        if (child.tag === 'HUSB' || child.tag === 'WIFE') {
          parents.push(value);
        } else if (child.tag === 'CHIL') {
          children.push(value);
        }
      }
      doc.families.set(id, { id, parents, children });
    }
  }

  private dateFrom(eventNode: TreeNode): DateValue | undefined {
    const dateNode = eventNode.children.find((child) => child.tag === 'DATE');
    const value = dateNode?.value;
    if (!value) {
      return undefined;
    }
    const yearMatch = /\d{3,4}/.exec(value);
    const year = yearMatch ? Number(yearMatch[0]) : undefined;
    const upper = value.toUpperCase();
    const quality = upper.startsWith('ABT')
      ? 'about'
      : upper.startsWith('BEF')
        ? 'before'
        : upper.startsWith('AFT')
          ? 'after'
          : 'exact';
    return { year, quality };
  }
}
