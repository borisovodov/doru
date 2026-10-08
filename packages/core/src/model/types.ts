export type Sex = 'M' | 'F' | 'U';

export type DateQuality = 'exact' | 'about' | 'before' | 'after' | 'range' | 'unknown';

export interface DateValue {
  year?: number;
  month?: number;
  day?: number;
  text?: string;
  quality: DateQuality;
  place?: string;
}

export interface NamePart {
  given?: string;
  surname?: string;
  full?: string;
}

export interface PersonRecord {
  id: string;
  names: NamePart[];
  sex: Sex;
  birth?: DateValue;
  death?: DateValue;
}

export interface FamilyRecord {
  id: string;
  parents: string[];
  children: string[];
}

export interface SourceRecord {
  id: string;
  title: string;
  author?: string;
  publication?: string;
}

export interface NoteRecord {
  id: string;
  text: string;
  targetType?: string;
  targetId?: string;
}

export interface EventRecord {
  id: string;
  type: string;
  date?: DateValue;
  description?: string;
  place?: string;
  personId?: string;
  familyId?: string;
}

export interface MediaRecord {
  id: string;
  path: string;
  caption?: string;
  targetType?: string;
  targetId?: string;
}

export interface PlaceRecord {
  id: string;
  name: string;
  lat?: number;
  lon?: number;
}

export interface TreeDocument {
  persons: Map<string, PersonRecord>;
  families: Map<string, FamilyRecord>;
  sources: Map<string, SourceRecord>;
}

export function emptyDocument(): TreeDocument {
  return { persons: new Map(), families: new Map(), sources: new Map() };
}
