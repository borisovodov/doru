export type Sex = 'M' | 'F' | 'U';

export type DateQuality = 'exact' | 'about' | 'before' | 'after' | 'range' | 'unknown';

export interface DateValue {
  year?: number | undefined;
  month?: number | undefined;
  day?: number | undefined;
  text?: string | undefined;
  quality: DateQuality;
  place?: string | undefined;
}

export interface NamePart {
  given?: string | undefined;
  surname?: string | undefined;
  full?: string | undefined;
}

export interface PersonRecord {
  id: string;
  names: NamePart[];
  sex: Sex;
  birth?: DateValue | undefined;
  death?: DateValue | undefined;
}

export interface FamilyRecord {
  id: string;
  parents: string[];
  children: string[];
}

export interface SourceRecord {
  id: string;
  title: string;
  author?: string | undefined;
  publication?: string | undefined;
}

export interface NoteRecord {
  id: string;
  text: string;
  targetType?: string | undefined;
  targetId?: string | undefined;
}

export interface EventRecord {
  id: string;
  type: string;
  date?: DateValue | undefined;
  description?: string | undefined;
  place?: string | undefined;
  personId?: string | undefined;
  familyId?: string | undefined;
}

export interface MediaRecord {
  id: string;
  path: string;
  caption?: string | undefined;
  targetType?: string | undefined;
  targetId?: string | undefined;
}

export interface PlaceRecord {
  id: string;
  name: string;
  lat?: number | undefined;
  lon?: number | undefined;
}

export interface TreeDocument {
  persons: Map<string, PersonRecord>;
  families: Map<string, FamilyRecord>;
  sources: Map<string, SourceRecord>;
}

export function emptyDocument(): TreeDocument {
  return { persons: new Map(), families: new Map(), sources: new Map() };
}
