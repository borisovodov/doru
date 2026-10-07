import type { TreeDocument } from '../model/types';

export interface GedcomWriter {
  export(doc: TreeDocument): string;
}

export class Gedcom70Writer implements GedcomWriter {
  export(doc: TreeDocument): string {
    const lines: string[] = [];
    lines.push('0 HEAD');
    lines.push('1 GEDC');
    lines.push('2 VERS 7.0');
    lines.push('1 CHAR UTF-8');

    for (const person of doc.persons.values()) {
      lines.push(`0 @${person.id}@ INDI`);
      for (const name of person.names) {
        if (name.full) {
          lines.push(`1 NAME ${name.full}`);
        }
      }
      if (person.sex === 'M' || person.sex === 'F') {
        lines.push(`1 SEX ${person.sex}`);
      }
      if (person.birth?.year !== undefined) {
        lines.push('1 BIRT');
        lines.push(`2 DATE ${person.birth.year}`);
      }
      if (person.death?.year !== undefined) {
        lines.push('1 DEAT');
        lines.push(`2 DATE ${person.death.year}`);
      }
    }

    lines.push('0 TRLR');
    return `${lines.join('\n')}\n`;
  }
}
