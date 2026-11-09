/**
 * The tree domain model shared by the database layer, the operation layer
 * and the renderer (over IPC). Pure data shapes plus a handful of helpers;
 * no database or UI code lives here.
 */

export type Sex = 'M' | 'F' | 'X' | 'U';

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/**
 * How precise or qualified a date is. 'range' covers both bounded ranges
 * ("between … and …") and open-ended periods ("from …", "… to …"): the
 * `component` is the start bound and `end` the end bound, either of which
 * may be missing.
 */
export type DateQuality = 'exact' | 'about' | 'before' | 'after' | 'range' | 'unknown';

/**
 * One calendar date with partial precision: any of year/month/day may be
 * unknown. Years are 1-based; `epoch: 'BCE'` marks years before the common
 * era. `calendar` is absent for Gregorian, 'julian', 'french_republican' or
 * 'hebrew' for the other GEDCOM calendars; unknown values (extension
 * calendars) are kept verbatim and treated as opaque.
 */
export interface DateComponent {
  calendar?: string | undefined;
  year?: number | undefined;
  /**
   * The calendar month: a number 1–12 for the Gregorian and Julian
   * calendars, or the calendar's own month code (e.g. 'VEND', 'TSH') for
   * the calendars the UI does not edit numerically yet.
   */
  month?: number | string | undefined;
  day?: number | undefined;
  epoch?: 'BCE' | undefined;
}

/** A time of day, optionally with UTC flag (GEDCOM TIME). */
export interface TimeValue {
  hour: number;
  minute: number;
  second?: number | undefined;
  fraction?: string | undefined;
  utc?: boolean | undefined;
}

export interface DateValue {
  /** The date row id, when the date is addressable (for edits and citations). */
  id?: string | undefined;
  quality: DateQuality;
  /**
   * Refines an 'about' date: how the approximation was reached — ABT
   * (near), CAL (calculated), EST (estimated). Only meaningful when
   * `quality` is 'about'; imported data keeps it, the editor does not
   * expose it yet.
   */
  modifier?: 'ABT' | 'CAL' | 'EST' | undefined;
  /** The primary date; absent when only `text` is known. */
  component?: DateComponent | undefined;
  /** The end bound when `quality` is 'range'. */
  end?: DateComponent | undefined;
  /** Free-text date description, shown when the structured fields cannot express the date. */
  text?: string | undefined;
  /** Time of day, when known. */
  time?: TimeValue | undefined;
}

/** The astronomical (signed) year of a date component: BCE years count down from 0. */
export function signedYear(component: DateComponent | undefined): number | undefined {
  if (component?.year === undefined) {
    return undefined;
  }
  return component.epoch === 'BCE' ? 1 - component.year : component.year;
}

// ---------------------------------------------------------------------------
// Persons, families, facts
// ---------------------------------------------------------------------------

/**
 * One piece of a person's name: a given name, a surname, a prefix, … The
 * pieces are stored as rows; any number of each kind is allowed. `full` is a
 * special kind holding the display form verbatim when it cannot be derived
 * from the pieces.
 */
export type NamePartKind =
  | 'full'
  | 'prefix'
  | 'given'
  | 'nickname'
  | 'surnamePrefix'
  | 'surname'
  | 'suffix';

export interface NamePart {
  id: string;
  kind: NamePartKind;
  value: string;
  position: number;
}

/**
 * One name of a person. A person can carry several names (birth name,
 * married name, alias, …) and each name can carry variants (translations,
 * phonetic and romanized forms) as nested `variants`. `id` keeps the name
 * addressable across edits (citations and notes may target it).
 *
 * The flat fields (`full`, `given`, `surname`, …) are projections of the
 * first part of each kind — kept for the renderer and the agents; the parts
 * themselves live in `parts`. When `parts` is absent on write, the flat
 * fields are turned into parts by the repository.
 */
export interface PersonName {
  id: string;
  /** Translation/phonetic/romanized variant of another name; undefined for a top-level name. */
  kind?: 'translation' | 'phonetic' | 'romanized' | undefined;
  language?: string | undefined;
  /** The name's kind: 'birth', 'maiden', 'married', 'aka', … */
  type?: string | undefined;
  /** The preferred name of the person. */
  primary?: boolean | undefined;
  date?: DateValue | undefined;
  /** The verbatim display form, when a 'full' part is stored; consumers join the pieces otherwise. */
  full?: string | undefined;
  given?: string | undefined;
  surname?: string | undefined;
  /** Non-indexing pre-part of the surname ('van', 'de', 'von', …). */
  surnamePrefix?: string | undefined;
  nickname?: string | undefined;
  prefix?: string | undefined;
  suffix?: string | undefined;
  parts?: NamePart[] | undefined;
  variants?: PersonName[] | undefined;
}

/**
 * A fact about a person or a family: a life event (birth, death, marriage)
 * or an attribute (occupation, residence). The `tag` names the kind
 * ('BIRT', 'DEAT', 'MARR', 'OCCU', …; 'EVEN'/'FACT' carry their subtype in
 * `type`), `value` holds the payload — an attribute value, a free-text
 * description, or the assertion marker on events.
 */
export interface FactRecord {
  id: string;
  /** The owning person; exactly one of `personId` / `familyId` is set. */
  personId?: string | undefined;
  /** The owning family; exactly one of `personId` / `familyId` is set. */
  familyId?: string | undefined;
  tag: string;
  /** Free-text subtype refining the tag (required for generic EVEN/FACT). */
  type?: string | undefined;
  value?: string | undefined;
  /** The fact asserts the event did NOT happen (GEDCOM NO). */
  negation?: boolean | undefined;
  date?: DateValue | undefined;
  /** Sort date (GEDCOM SDATE): orders the fact when the display date cannot. */
  sortDate?: DateValue | undefined;
  /** The place entity this fact happened at; the raw string stays in `place`. */
  placeId?: string | undefined;
  /** The place as typed/displayed. */
  place?: string | undefined;
  agency?: string | undefined;
  religiousAffiliation?: string | undefined;
  cause?: string | undefined;
  /** Display sentence template (GEDCOM SENT). */
  sentence?: string | undefined;
  quality?: string | undefined;
}

export interface PersonRecord {
  id: string;
  /** Identifier assigned by a GEDCOM import; provenance only. */
  xref?: string | undefined;
  sex: Sex;
  names: PersonName[];
  /** The person's facts (events and attributes), including birth and death. */
  facts: FactRecord[];
}

/** The person's fact with the given tag, if any (e.g. 'BIRT'). */
export function factOf(person: PersonRecord, tag: string): FactRecord | undefined {
  return person.facts.find((fact) => fact.tag === tag);
}

/** The astronomical year of the person's fact with the given tag, if known. */
export function factYear(person: PersonRecord | undefined, tag: string): number | undefined {
  return person ? signedYear(factOf(person, tag)?.date?.component) : undefined;
}

/** One partner slot of a family, with its addressable id and details. */
export interface FamilyPartnerLink {
  id: string;
  personId: string;
  preferred?: boolean | undefined;
  date?: DateValue | undefined;
}

/** One child slot of a family, with its addressable id and link details. */
export interface FamilyChildLink {
  id: string;
  childId: string;
  pedigree?: string | undefined;
  pedigreePhrase?: string | undefined;
  status?: string | undefined;
  fatherRelation?: string | undefined;
  motherRelation?: string | undefined;
}

export interface FamilyRecord {
  id: string;
  /** Identifier assigned by a GEDCOM import; provenance only. */
  xref?: string | undefined;
  /** The partners, ordered (the first is the "leftmost" in the UI) — projection of `partnerLinks`. */
  partners: string[];
  children: string[];
  /** The ordered partner slots; the repository always fills them. */
  partnerLinks?: FamilyPartnerLink[] | undefined;
  childLinks?: FamilyChildLink[] | undefined;
}

// ---------------------------------------------------------------------------
// Places
// ---------------------------------------------------------------------------

/**
 * One jurisdiction level of a place name ('Moscow' in 'Moscow, Russia').
 * A place carries several name rows: the official name (one row per
 * jurisdiction) plus translations/phonetic/romanized rows.
 */
export interface PlaceName {
  id: string;
  kind?: 'official' | 'translation' | 'phonetic' | 'romanized' | undefined;
  language?: string | undefined;
  type?: string | undefined;
  position: number;
  value: string;
}

export interface PlaceRecord {
  id: string;
  xref?: string | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
  verified?: boolean | undefined;
  names: PlaceName[];
  hierarchy?: { parentId: string; type?: string }[] | undefined;
  postalCodes?: { id: string; code: string; date?: DateValue }[] | undefined;
}

/** The joined display form of a place: jurisdictions smallest first. */
export function placeName(place: PlaceRecord | undefined): string {
  if (!place) {
    return '';
  }
  return place.names
    .filter((name) => name.kind === undefined || name.kind === 'official')
    .sort((a, b) => a.position - b.position)
    .map((name) => name.value)
    .filter((value) => value !== '')
    .join(', ');
}

// ---------------------------------------------------------------------------
// Sources, citations, notes, media
// ---------------------------------------------------------------------------

export interface SourceRecord {
  id: string;
  /** Identifier assigned by a GEDCOM import; provenance only. */
  xref?: string | undefined;
  title: string;
  abbreviation?: string | undefined;
  author?: string | undefined;
  publication?: string | undefined;
}

/**
 * A source attached to some part of the tree (a person, family, fact, name,
 * …). `page` is the location within the source, `quality` the reliability
 * assessment for this claim.
 */
export interface CitationRecord {
  id: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  page?: string | undefined;
  quality?: string | undefined;
}

export interface NoteRecord {
  id: string;
  text: string;
  targetType?: string | undefined;
  targetId?: string | undefined;
}

export interface MediaRecord {
  id: string;
  /** Project-relative path under the media folder. */
  path: string;
  title?: string | undefined;
  targetType?: string | undefined;
  targetId?: string | undefined;
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

/**
 * The machine-readable list of attachment target types. The polymorphic
 * attachment tables pair `target_type` with the target row's UUID.
 */
export const TARGET_TYPES = [
  'person',
  'family',
  'family_partner',
  'family_child',
  'fact',
  'name',
  'source',
  'citation',
  'note',
  'media',
  'media_file',
  'place',
  'repository',
  'submitter',
  'association',
  'ordinance',
  'evidence',
  'todo',
  'research_document',
  'research_activity',
  'title',
  'census',
] as const;

export type TargetType = (typeof TARGET_TYPES)[number];

// ---------------------------------------------------------------------------
// Whole-tree helpers
// ---------------------------------------------------------------------------

/**
 * The whole tree as plain maps — the shape the validator and one-shot
 * analyses consume. The repository builds it on demand.
 */
export interface TreeDocument {
  persons: Map<string, PersonRecord>;
  families: Map<string, FamilyRecord>;
}

export function emptyDocument(): TreeDocument {
  return { persons: new Map(), families: new Map() };
}
