/**
 * Primitives of the GEDCOM object model.
 *
 * Every type in this file maps to a concept of the GEDCOM specifications.
 * Section references carry the spec version explicitly because the two
 * supported versions number their chapters differently:
 * - `GEDCOM 7.0 §…` — The FamilySearch GEDCOM Specification 7.0:
 *   chapter 1 (container format identifiers), chapter 2 (data types) and
 *   chapter 6 (known calendars).
 * - `GEDCOM 5.5.1 §…` — The GEDCOM Standard 5.5.1: chapter 1 (data
 *   representation grammar), chapter 2 (lineage-linked grammar: record
 *   structures p.23, substructures p.31, primitive elements p.41),
 *   appendix A (tag definitions p.83).
 *
 * This is a single model spanning both versions; 5.5.1-only concepts are
 * included alongside the 7.0 model.
 */

// ---------------------------------------------------------------------------
// GEDCOM 7.0 §1.3 Lines — identifiers and tags
// ---------------------------------------------------------------------------

/**
 * GEDCOM 7.0 §1.3 Lines, production `Xref` — a cross-reference identifier `@...@`.
 * Each cross-reference identifier is unique within a given document and is
 * not retained between data streams.
 *
 * GEDCOM 5.5.1 §2 Primitive Elements (p.64), `XREF` — identical concept;
 * additionally limited to 22 characters including the at signs, and the
 * first character must be an alpha or a digit.
 */
export type Xref = string;

/**
 * GEDCOM 7.0 §1.3 Lines, production `voidPtr` — the literal `@VOID@`, encoding a null
 * pointer.
 */
export type VoidPointer = '@VOID@';

/**
 * GEDCOM 7.0 §1.3 Lines, production `pointer` — a pointer payload: either a
 * cross-reference identifier or the void pointer.
 *
 * The type parameter documents which record type is pointed to; it is not
 * enforced at the type level.
 *
 * GEDCOM 5.5.1 §1 Grammar (p.13), `pointer` — identical concept; the
 * pointers must match a corresponding unique xref_ID within the
 * transmission. (The 7.0 void pointer `@VOID@` does not exist in 5.5.1.)
 */
export type Pointer<_TRecord> = Xref | VoidPointer;

/**
 * GEDCOM 7.0 §1.3 Lines, production `stdTag` — a standard tag: an uppercase letter
 * followed by any number of uppercase letters, digits, and underscores.
 *
 * GEDCOM 5.5.1 §1 Grammar (p.13), `tag` — identical concept, but 5.5.1 tags
 * may also start with a digit (production `alphanum`); tags are always
 * uppercase in practice.
 */
export type StdTag = string;

/**
 * GEDCOM 7.0 §1.3 Lines, production `extTag` — an extension tag: an underscore
 * followed by one or more tag characters (uppercase letters, digits,
 * underscores).
 *
 * GEDCOM 5.5.1 §2 (p.56), `NEW_TAG` — user-defined tags must begin with an
 * underscore; 5.5.1 has no documented-extension mechanism (its SCHEMA
 * concept was removed in draft 5.4).
 */
export type ExtensionTag = `_${string}`;

/**
 * GEDCOM 7.0 §1.3 Lines, production `Tag` — a tag, either standard or extension.
 */
export type Tag = StdTag | ExtensionTag;

/** GEDCOM dialect versions. The parsers know 7.0 and 5.5.1; a file
 * declaring GEDCOM 5.5.5 parses under the 5.5.1 rules, with the 5.5.5
 * vocabulary accepted as part of the 5.x grammar (see the README's
 * Parsing section). The serializers emit 5.5.1 and 7.0 only. */
export type GedcomVersion = '5.5.1' | '7.0';

// ---------------------------------------------------------------------------
// GEDCOM 7.0 §2.1 Text
// ---------------------------------------------------------------------------

/**
 * GEDCOM 7.0 §2.1 Text — a free-text string in a human language: an unconstrained
 * sequence of characters (any character except the banned characters of
 * GEDCOM 7.0 §1.1). URI: `xsd:string`.
 *
 * GEDCOM 5.5.1 §2 Primitive Elements (p.63), `TEXT` — same concept;
 * 5.5.1 additionally constrains the length to 248 characters.
 */
export type Text = string;

// ---------------------------------------------------------------------------
// GEDCOM 7.0 §2.2 Integer
// ---------------------------------------------------------------------------

/**
 * GEDCOM 7.0 §2.2 Integer — a non-negative integer in base-10. Negative integers are
 * not supported by the specification; leading zeros have no semantic
 * meaning. URI: `xsd:nonNegativeInteger`.
 *
 * GEDCOM 5.5.1 §1 Grammar (p.12), `digit` / §2 (p.57), `NUMBER` — same
 * concept.
 */
export type Integer = number;

// ---------------------------------------------------------------------------
// GEDCOM 7.0 §2.3 Enumeration
// ---------------------------------------------------------------------------

/**
 * GEDCOM 7.0 §2.3 Enumeration, production `stdEnum` — a standard enumeration value:
 * a standard tag or an integer.
 */
export type StdEnum = StdTag | Integer;

/**
 * GEDCOM 7.0 §2.3 Enumeration, production `Enum` — an enumeration value: standard or
 * extension. URI: `g7:type-Enum`.
 *
 * GEDCOM 5.5.1 §2 Usage Conventions (p.21) — the same concept ("controlled
 * line_value choices"); 5.5.1 defines the choices inline in each primitive
 * element and requires all controlled values to be considered case
 * insensitive.
 */
export type EnumValue = StdEnum | ExtensionTag;

// ---------------------------------------------------------------------------
// GEDCOM 7.0 §2.4 Date
// ---------------------------------------------------------------------------

/**
 * GEDCOM 7.0 §2.4 Date, production `calendar` — a calendar name. The four standard
 * calendars are defined in GEDCOM 7.0 §6.1; extension calendars use extension tags.
 *
 * GEDCOM 5.5.1 §2 Primitive Elements (p.45), `DATE_CALENDAR` — the same
 * four calendars, but written as `@#D…@` escape sequences preceding the
 * date (e.g. `@#DHEBREW@`); 5.5.1 additionally reserves ROMAN and UNKNOWN
 * calendar escapes, which it never defines. The escape form is a
 * serialization detail; this model keeps the calendar as data.
 */
export type Calendar = 'GREGORIAN' | 'JULIAN' | 'FRENCH_R' | 'HEBREW' | ExtensionTag;

/**
 * GEDCOM 7.0 §6.1 GREGORIAN — the months permitted in the Gregorian calendar. The
 * same months are permitted in the JULIAN calendar (GEDCOM 7.0 §6.1 JULIAN). Each
 * month has the URI `g7:month-<tag>`.
 *
 * GEDCOM 5.5.1 §2 Primitive Elements (p.52), `MONTH` — identical month tags.
 */
export const GREGORIAN_MONTHS = {
  JAN: 'January',
  FEB: 'February',
  MAR: 'March',
  APR: 'April',
  MAY: 'May',
  JUN: 'June',
  JUL: 'July',
  AUG: 'August',
  SEP: 'September',
  OCT: 'October',
  NOV: 'November',
  DEC: 'December',
} as const;

/** GEDCOM 7.0 §6.1 GREGORIAN — a Gregorian month tag. */
export type GregorianMonth = keyof typeof GREGORIAN_MONTHS;

/** GEDCOM 7.0 §6.1 JULIAN — a Julian month tag; identical to the Gregorian months. */
export type JulianMonth = GregorianMonth;

/**
 * GEDCOM 7.0 §6.1 FRENCH_R — the months permitted in the French Republican calendar.
 *
 * GEDCOM 5.5.1 §2 Primitive Elements (p.53), `MONTH_FREN` — identical month tags.
 */
export const FRENCH_REPUBLICAN_MONTHS = {
  VEND: 'Vendémiaire',
  BRUM: 'Brumaire',
  FRIM: 'Frimaire',
  NIVO: 'Nivôse',
  PLUV: 'Pluviôse',
  VENT: 'Ventôse',
  GERM: 'Germinal',
  FLOR: 'Floréal',
  PRAI: 'Prairial',
  MESS: 'Messidor',
  THER: 'Thermidor',
  FRUC: 'Fructidor',
  COMP: 'Jour Complémentaires',
} as const;

/** GEDCOM 7.0 §6.1 FRENCH_R — a French Republican month tag. */
export type FrenchRepublicanMonth = keyof typeof FRENCH_REPUBLICAN_MONTHS;

/**
 * GEDCOM 7.0 §6.1 HEBREW — the months permitted in the Hebrew calendar.
 *
 * GEDCOM 5.5.1 §2 Primitive Elements (p.53), `MONTH_HEBR` — identical month
 * tags (5.5.1 spells the names slightly differently, e.g. "Tishri").
 */
export const HEBREW_MONTHS = {
  TSH: 'Tishrei (תִּשְׁרֵי)',
  CSH: 'Marcheshvan (מַרְחֶשְׁוָן) or Cheshvan (חֶשְׁוָן)',
  KSL: 'Kislev (כִּסְלֵו)',
  TVT: 'Tevet (טֵבֵת)',
  SHV: 'Shevat (שְׁבָט)',
  ADR: 'Adar I, Adar Rishon, First Adar, or Adar Aleph (אדר א׳)',
  ADS: 'Adar (אֲדָר); or Adar II, Adar Sheni, Second Adar, or Adar Bet (אדר ב׳)',
  NSN: 'Nisan (נִיסָן)',
  IYR: 'Iyar (אִייָר)',
  SVN: 'Sivan (סִיוָן)',
  TMZ: 'Tammuz (תַּמּוּז)',
  AAV: 'Av (אָב)',
  ELL: 'Elul (אֱלוּל)',
} as const;

/** GEDCOM 7.0 §6.1 HEBREW — a Hebrew month tag. */
export type HebrewMonth = keyof typeof HEBREW_MONTHS;

/**
 * GEDCOM 7.0 §2.4 Date, production `month` — a month tag. Months are constrained by
 * the calendar of the enclosing date (GEDCOM 7.0 §6.1); extension calendars must use
 * extension month tags.
 */
export type GedcomMonth =
  | GregorianMonth
  | JulianMonth
  | FrenchRepublicanMonth
  | HebrewMonth
  | ExtensionTag;

/**
 * GEDCOM 7.0 §2.4 Date, production `epoch` — an epoch marker. Only the BCE epoch is
 * standard; it is permitted in the GREGORIAN and JULIAN calendars only
 * (GEDCOM 7.0 §6.1). FRENCH_R and HEBREW permit no epoch marker. Extension calendars
 * may define extension epochs.
 *
 * GEDCOM 5.5.1 §2 Primitive Elements (p.45) — 5.5.1 writes the same concept
 * as the suffix `B.C.` after the year in GREGORIAN and JULIAN dates.
 */
export type Epoch = 'BCE' | ExtensionTag;

/**
 * GEDCOM 7.0 §2.4 Date, production `date` — a single calendar date. An absent
 * calendar is equivalent to GREGORIAN. Every date must have a year; day
 * and month are optional.
 *
 * GEDCOM 5.5.1 §2 Primitive Elements (p.45), `DATE_GREG` / `DATE_JULN` /
 * `DATE_HEBR` / `DATE_FREN` — the same partial-precision form (year,
 * month+year, day+month+year); 5.5.1 writes the BCE epoch as `B.C.` and
 * allows the dual-year modifier `NUMBER/NUMBER`.
 *
 * GEDCOM 5.5.5 §2 Primitive Elements (p.83) additionally allows the
 * year-less form `day month` (a birthday whose year is unknown) in
 * `DATE_GREG` — modelled as an absent `year`. Both serializers drop
 * such a date (7.0 and 5.5.1 both require a year), and the calendar
 * arithmetic leaves it unbounded.
 */
export interface DateFields {
  /** GEDCOM 7.0 §2.4 — `[calendar D]`, optional; absent means GREGORIAN. */
  calendar?: Calendar;
  /** GEDCOM 7.0 §2.4 — `day`, optional; 1 to a month-specific maximum. */
  day?: Integer;
  /** GEDCOM 7.0 §2.4 — `month`, optional; constrained by the calendar (GEDCOM 7.0 §6.1). */
  month?: GedcomMonth;
  /** GEDCOM 7.0 §2.4 — `year`, required; absent only in the GEDCOM 5.5.5 year-less `day month` form (GEDCOM 5.5.5 §2 p.83). */
  year?: Integer;
  /** GEDCOM 7.0 §2.4 — `[D epoch]`, optional. */
  epoch?: Epoch;
}

/**
 * GEDCOM 7.0 §2.4 Date, production `date` as the plain alternative of `DateValue` —
 * a single date with partial precision allowed.
 */
export interface PlainDate extends DateFields {
  readonly kind: 'date';
}

/**
 * GEDCOM 7.0 §2.4 Date, production `dateRange` — `BET date AND date`: exact date
 * unknown, but no earlier than the first date and no later than the
 * second.
 */
export interface DateRange {
  readonly kind: 'range';
  /** GEDCOM 7.0 §2.4 — the date after `BET`. */
  start: DateFields;
  /** GEDCOM 7.0 §2.4 — the date after `AND`. */
  end: DateFields;
}

/**
 * GEDCOM 7.0 §2.4 Date, production `dateRange` — `BEF date` / `AFT date`: exact date
 * unknown, but no later / no earlier than the given date.
 */
export interface DateBound {
  readonly kind: 'bound';
  /** GEDCOM 7.0 §2.4 — `BEF` (no later than) or `AFT` (no earlier than). */
  modifier: 'BEF' | 'AFT';
  date: DateFields;
}

/**
 * GEDCOM 7.0 §2.4 Date, production `dateApprox` — `ABT` / `CAL` / `EST` date: exact
 * date unknown, but near the given date.
 */
export interface DateApprox {
  readonly kind: 'approx';
  /** GEDCOM 7.0 §2.4 — `ABT` (near), `CAL` (calculated), `EST` (near and calculated). */
  modifier: 'ABT' | 'CAL' | 'EST';
  date: DateFields;
}

/**
 * GEDCOM 7.0 §2.4 Date, production `DatePeriod` — a time interval spanning multiple
 * days: `FROM date`, `TO date`, `FROM date TO date`, or the empty period.
 * Both boundaries are optional; at least one of `from` / `to` should be
 * present for a meaningful period.
 *
 * GEDCOM 5.5.1 §2 Primitive Elements (p.46), `DATE_PERIOD` — identical
 * `FROM`/`TO` semantics.
 */
export interface DatePeriodValue {
  readonly kind: 'period';
  /** GEDCOM 7.0 §2.4 — the date after `FROM`: the period begins on this date. */
  from?: DateFields;
  /** GEDCOM 7.0 §2.4 — the date after `TO`: the period ends on this date. */
  to?: DateFields;
}

/**
 * GEDCOM 7.0 §2.4 Date — `DateValue` may be the empty string when no suitable form is
 * known but a substructure (such as a PHRASE or TIME) is desired. The
 * empty form is represented by this variant.
 */
export interface EmptyDateValue {
  readonly kind: 'unknown';
}

/**
 * GEDCOM 7.0 §2.4 Date, production `DateValue` — a generic date: a single date, a
 * date range, a bound, an approximate date, a date period, or empty.
 * URI: `g7:type-Date`.
 *
 * GEDCOM 5.5.1 §2 Primitive Elements (p.47), `DATE_VALUE` — the same
 * semantics (`<DATE>`, `<DATE_PERIOD>`, `<DATE_RANGE>`,
 * `<DATE_APPROXIMATED>`). 5.5.1 additionally allows an interpreted date
 * with a parenthesized phrase (`INT <DATE> (<DATE_PHRASE>)`) and a
 * phrase-only form (`(<DATE_PHRASE>)`); in 7.0 the phrase moved to the
 * PHRASE substructure of g7:DATE. 5.5.1 also writes the year modifier
 * `1648/49` (dual dates) which 7.0 moved to a PHRASE as well. This union
 * is unchanged by these differences: an imported 5.5.1 `INT` date keeps
 * the date here and the phrase in the DATE structure's `phrase`, and
 * dual years likewise move to `phrase`; the 5.5.1 syntax (calendar
 * escapes, trailing `B.C.`) is handled by the parser and serializer.
 */
export type DateValue =
  | PlainDate
  | DateRange
  | DateBound
  | DateApprox
  | DatePeriodValue
  | EmptyDateValue;

/**
 * GEDCOM 7.0 §2.4 Date, production `DateExact` — a fully-known date: `day month year`
 * in the Gregorian calendar, used for timestamps. URI: `g7:type-Date#exact`.
 *
 * GEDCOM 5.5.1 §2 Primitive Elements (p.45), `DATE_EXACT` — identical form
 * (`<DAY> <MONTH> <YEAR_GREG>`); 5.5.1 writes the BCE epoch as the suffix
 * `B.C.` and additionally allows the year modifier `NUMBER/NUMBER`.
 */
export interface DateExact {
  /** GEDCOM 7.0 §2.4 — `day`. */
  day: Integer;
  /** GEDCOM 7.0 §2.4 — `month`; DateExact is always in the Gregorian calendar. */
  month: GregorianMonth;
  /** GEDCOM 7.0 §2.4 — `year`. */
  year: Integer;
  /** GEDCOM 7.0 §2.4 — the BCE epoch is the only one permitted in the Gregorian calendar. */
  epoch?: Epoch;
}

// ---------------------------------------------------------------------------
// GEDCOM 7.0 §2.5 Time
// ---------------------------------------------------------------------------

/**
 * GEDCOM 7.0 §2.5 Time — a time on a 24-hour clock, in event-local time or in UTC
 * (indicated by the presence of `utc`). URI: `g7:type-Time`.
 *
 * GEDCOM 5.5.1 §2 Primitive Elements (p.63), `TIME_VALUE` — same 24-hour
 * `hh:mm:ss.fs` form; 5.5.1 has no UTC marker (the `utc` flag is 7.0-only).
 */
export interface TimeValue {
  /** GEDCOM 7.0 §2.5 — `hour`, 0 through 23. */
  hour: Integer;
  /** GEDCOM 7.0 §2.5 — `minute`, 0 through 59. */
  minute: Integer;
  /** GEDCOM 7.0 §2.5 — `second`, 0 through 59; optional. */
  second?: Integer;
  /** GEDCOM 7.0 §2.5 — `fraction`, a string of digits after the decimal point; optional. */
  fraction?: Text;
  /** GEDCOM 7.0 §2.5 — trailing `Z`: the time is UTC; absent: event-local time. */
  utc?: true;
}

// ---------------------------------------------------------------------------
// GEDCOM 7.0 §2.6 Age
// ---------------------------------------------------------------------------

/**
 * GEDCOM 7.0 §2.6 Age, production `ageBound` — `<` (the real age was less than the
 * provided age) or `>` (greater than the provided age).
 */
export type AgeBound = '<' | '>';

/**
 * GEDCOM 7.0 §2.6 Age — an age as a count of years, months, weeks, and days. At least
 * one of the duration fields should be present; this is not enforceable in
 * TypeScript. URI: `g7:type-Age`.
 *
 * GEDCOM 5.5.1 §2 Primitive Elements (p.42), `AGE_AT_EVENT` — the same
 * `<`/`>` bound plus `YYy MMm DDDd` counts, but without weeks (`w`) and
 * with the additional keyword values CHILD, INFANT, and STILLBORN
 * (modelled as `description`).
 */
export interface AgeValue {
  /** GEDCOM 7.0 §2.6 — `[ageBound D]`, optional. */
  bound?: AgeBound;
  /** GEDCOM 7.0 §2.6 — `years = Integer "y"`, optional. */
  years?: Integer;
  /** GEDCOM 7.0 §2.6 — `months = Integer "m"`, optional. */
  months?: Integer;
  /** GEDCOM 7.0 §2.6 — `weeks = Integer "w"`, optional. Dropped when serializing to 5.5.1 (an age of only weeks is dropped entirely). */
  weeks?: Integer;
  /** GEDCOM 7.0 §2.6 — `days = Integer "d"`, optional. */
  days?: Integer;
  /**
   * GEDCOM 5.5.1 §2 (p.42) — a descriptive age keyword: CHILD (less than
   * 8 years), INFANT (less than 1 year), or STILLBORN (died just prior
   * to, at, or near birth). Removed in 7.0, which moved such information
   * to a PHRASE. When serializing to 7.0 the keyword is projected onto
   * the numeric bound (`CHILD` → `< 8y`, `INFANT` → `< 1y`,
   * `STILLBORN` → `0y`) and kept in the PHRASE.
   */
  description?: 'CHILD' | 'INFANT' | 'STILLBORN';
}

// ---------------------------------------------------------------------------
// GEDCOM 7.0 §2.7 List
// ---------------------------------------------------------------------------

/**
 * GEDCOM 7.0 §2.7 List — `List:Text`: a sequence of Text values, serialized
 * comma-separated. URI: `g7:type-List#Text`.
 *
 * GEDCOM 5.5.1 §2 Primitive Elements (p.58), `PLACE_NAME` — the same
 * comma-separated list form (used by PLAC and FORM).
 */
export type ListText = Text[];

/**
 * GEDCOM 7.0 §2.7 List — `List:Enum`: a sequence of enumeration values, serialized
 * comma-separated. URI: `g7:type-List#Enum`.
 */
export type ListEnum<E extends EnumValue> = E[];

// ---------------------------------------------------------------------------
// GEDCOM 7.0 §2.8 Personal Name
// ---------------------------------------------------------------------------

/**
 * GEDCOM 7.0 §2.8 Personal Name — a personal name. The character U+002F delimits the
 * portion that most closely matches the concept of a surname: the payload
 * form is `[nameStr] "/" [nameStr] "/" [nameStr]`. URI: `g7:type-Name`.
 *
 * GEDCOM 5.5.1 §2 Primitive Elements (p.54), `NAME_PERSONAL` — identical
 * slash-delimited form (`<NAME_TEXT>`, `/<NAME_TEXT>/`,
 * `<NAME_TEXT> /<NAME_TEXT>/`, `/<NAME_TEXT>/ <NAME_TEXT>`,
 * `<NAME_TEXT> /<NAME_TEXT>/ <NAME_TEXT>`).
 */
export interface PersonalName {
  /** GEDCOM 7.0 §2.8 — the name text before the first slash; optional. */
  given?: Text;
  /** GEDCOM 7.0 §2.8 — the name text between the slashes (the surname); optional. */
  surname?: Text;
  /** GEDCOM 7.0 §2.8 — the name text after the second slash; optional. */
  suffix?: Text;
}

// ---------------------------------------------------------------------------
// GEDCOM 7.0 §2.9 Language
// ---------------------------------------------------------------------------

/**
 * GEDCOM 7.0 §2.9 Language — a human language or family of related languages, as
 * defined in BCP 47 (a sequence of language subtags separated by hyphens).
 * URI: `xsd:Language`.
 *
 * GEDCOM 5.5.1 §2 Primitive Elements (p.50), `LANGUAGE_ID` — 5.5.1 uses a
 * fixed table of English language names instead of BCP 47 tags. The table
 * is preserved verbatim as `LANGUAGE_IDS_551`; the serializer maps these
 * names to and from BCP 47 tags. A few entries are not one-to-one (e.g.
 * Catalan vs Catalan_Spn, and the specification's own typos such as
 * "Mandrin"), so the mapping rules belong to the serializer and this type
 * stays a plain string.
 */
export type Language = string;

/**
 * GEDCOM 5.5.1 §2 Primitive Elements (p.50–51), `LANGUAGE_ID` — the fixed
 * table of language identifiers permitted in 5.5.1, preserved verbatim
 * (including the specification's own typos such as "Mandrin" and
 * "Pusto"). The first group is the Latin-based languages; the second was
 * listed by the specification as "Other languages not supported until
 * UNICODE". The authoritative 5.5.1 side of the BCP 47 mapping used by
 * the serializer.
 */
export const LANGUAGE_IDS_551 = [
  // Latin-based languages.
  'Afrikaans',
  'Albanian',
  'Anglo-Saxon',
  'Catalan',
  'Catalan_Spn',
  'Czech',
  'Danish',
  'Dutch',
  'English',
  'Esperanto',
  'Estonian',
  'Faroese',
  'Finnish',
  'French',
  'German',
  'Hawaiian',
  'Hungarian',
  'Icelandic',
  'Indonesian',
  'Italian',
  'Latvian',
  'Lithuanian',
  'Navaho',
  'Norwegian',
  'Polish',
  'Portuguese',
  'Romanian',
  'Serbo_Croa',
  'Slovak',
  'Slovene',
  'Spanish',
  'Swedish',
  'Turkish',
  'Wendic',
  // "Other languages not supported until UNICODE".
  'Amharic',
  'Arabic',
  'Armenian',
  'Assamese',
  'Belorusian',
  'Bengali',
  'Braj',
  'Bulgarian',
  'Burmese',
  'Cantonese',
  'Church-Slavic',
  'Dogri',
  'Georgian',
  'Greek',
  'Gujarati',
  'Hebrew',
  'Hindi',
  'Japanese',
  'Kannada',
  'Khmer',
  'Konkani',
  'Korean',
  'Lahnda',
  'Lao',
  'Macedonian',
  'Maithili',
  'Malayalam',
  'Mandrin',
  'Mandarin',
  'Manipuri',
  'Marathi',
  'Mewari',
  'Nepali',
  'Oriya',
  'Pahari',
  'Pali',
  'Panjabi',
  'Persian',
  'Prakrit',
  'Pusto',
  'Rajasthani',
  'Russian',
  'Sanskrit',
  'Serb',
  'Tagalog',
  'Tamil',
  'Telugu',
  'Thai',
  'Tibetan',
  'Ukrainian',
  'Urdu',
  'Vietnamese',
  'Yiddish',
] as const;

/** A GEDCOM 5.5.1 `LANGUAGE_ID` value. */
export type LanguageId551 = (typeof LANGUAGE_IDS_551)[number];

// ---------------------------------------------------------------------------
// GEDCOM 7.0 §2.10 Media Type
// ---------------------------------------------------------------------------

/**
 * GEDCOM 7.0 §2.10 Media Type — the encoding of information in bytes or characters,
 * as defined in RFC 2045 section 5.1 and registered by the IANA.
 * URI: `dcat:mediaType`.
 *
 * GEDCOM 5.5.1 §2 Primitive Elements (p.54), `MULTIMEDIA_FORMAT` — 5.5.1
 * restricts the value to the fixed set of `MULTIMEDIA_FORMATS_551`
 * (file extensions) instead of RFC 2045 media types; mapping between the
 * two (e.g. `jpg` ↔ `image/jpeg`) is a serialization concern.
 */
export type MediaType = string;

/**
 * GEDCOM 5.5.1 §2 Primitive Elements (p.54), `MULTIMEDIA_FORMAT` — the
 * closed set of file formats permitted in 5.5.1 FILE.FORM payloads. The
 * authoritative 5.5.1 side of the extension ↔ media-type mapping used by
 * the serializer. Removed in GEDCOM 7.0 (RFC 2045 media types).
 */
export const MULTIMEDIA_FORMATS_551 = ['bmp', 'gif', 'jpg', 'ole', 'pcx', 'tif', 'wav'] as const;

/** A GEDCOM 5.5.1 `MULTIMEDIA_FORMAT` value. */
export type MultimediaFormat551 = (typeof MULTIMEDIA_FORMATS_551)[number];

/**
 * GEDCOM 5.5.5 §2 Primitive Elements (p.94), `MULTIMEDIA_FORMAT` — the
 * 5.5.5 set: the 5.5.1 set expanded with the four-letter `JPEG` and
 * `TIFF` (the spellings GEDCOM 5.5 already used; 5.5.5 makes them the
 * required spellings, keeping `JPG`/`TIF` supported but deprecated) and
 * with `OLE` removed (OLE is a technology, not a multimedia format —
 * GEDCOM 5.5.5 §2 p.94). The 5.x parser accepts the union of this set
 * and `MULTIMEDIA_FORMATS_551` (including `OLE`); the 5.5.1 serializer
 * still writes only the 5.5.1 set.
 */
export const MULTIMEDIA_FORMATS_555 = ['bmp', 'gif', 'jpg', 'jpeg', 'pcx', 'tif', 'tiff', 'wav'] as const;

/** A GEDCOM 5.5.5 `MULTIMEDIA_FORMAT` value. */
export type MultimediaFormat555 = (typeof MULTIMEDIA_FORMATS_555)[number];

// ---------------------------------------------------------------------------
// GEDCOM 7.0 §2.11 Special
// ---------------------------------------------------------------------------

/**
 * GEDCOM 7.0 §2.11 Special — a string conforming to a case-specific standard or
 * constraints unique to the structure type using it (for example, the
 * payload of an IDNO structure depends on its TYPE substructure).
 * URI: `xsd:string`.
 *
 * GEDCOM 5.5.1 §2 Primitive Elements (p.63), `TEXT` — 5.5.1 has no named
 * "special" type; the same case-specific primitives are defined inline.
 */
export type Special = string;

// ---------------------------------------------------------------------------
// GEDCOM 7.0 §2.12 File Path
// ---------------------------------------------------------------------------

/**
 * GEDCOM 7.0 §2.12 File Path — the location of a digital file, as a valid URL string
 * (WHATWG): an absolute or relative URL, optionally with a fragment.
 * Version 7.0 supports ftp/http/https/file URLs and local relative paths.
 * URI: `g7:type-FilePath`.
 *
 * GEDCOM 5.5.1 §2 Primitive Elements (p.54), `MULTIMEDIA_FILE_REFERENCE` —
 * a complete local or remote file reference; same concept.
 */
export type FilePath = string;

// ---------------------------------------------------------------------------
// GEDCOM 7.0 §2.13 URI
// ---------------------------------------------------------------------------

/**
 * GEDCOM 7.0 §2.13 URI — an agent-controlled durable identifier: a URI Reference as
 * defined in RFC 3986 section 4.1. URI: `xsd:anyURI`.
 */
export type Uri = string;

// ---------------------------------------------------------------------------
// GEDCOM 7.0 §2.14 Tag Definition
// ---------------------------------------------------------------------------

/**
 * GEDCOM 7.0 §2.14 Tag Definition, production `TagDef` — an extension tag and the URI
 * it abbreviates within the current document. URI: `g7:type-TagDef`.
 */
export interface TagDefinitionValue {
  /** GEDCOM 7.0 §2.14 — the extension tag. */
  tag: ExtensionTag;
  /** GEDCOM 7.0 §2.14 — the URI the tag refers to. */
  uri: Uri;
}

// ---------------------------------------------------------------------------
// GEDCOM 7.0 §2.15 Latitude / §2.16 Longitude
// ---------------------------------------------------------------------------

/**
 * GEDCOM 7.0 §2.15 Latitude — a latitudinal coordinate: `N` or `S` followed by a
 * decimal number of degrees between 0 (the equator) and 90 (a pole).
 * URI: `g7:type-Latitude`.
 *
 * GEDCOM 5.5.1 §2 Primitive Elements (p.58), `PLACE_LATITUDE` — identical
 * `N/S + decimal degrees` form.
 */
export interface Latitude {
  /** GEDCOM 7.0 §2.15 — `N` north of the equator, `S` south of it. */
  direction: 'N' | 'S';
  /** GEDCOM 7.0 §2.15 — decimal degrees, 0 through 90. */
  degrees: number;
}

/**
 * GEDCOM 7.0 §2.16 Longitude — a longitudinal coordinate: `E` or `W` followed by a
 * decimal number of degrees between 0 (the prime meridian) and 180 (the
 * 180th meridian). URI: `g7:type-Longitude`.
 *
 * GEDCOM 5.5.1 §2 Primitive Elements (p.58), `PLACE_LONGITUDE` — identical
 * `E/W + decimal degrees` form.
 */
export interface Longitude {
  /** GEDCOM 7.0 §2.16 — `E` east of the prime meridian, `W` west of it. */
  direction: 'E' | 'W';
  /** GEDCOM 7.0 §2.16 — decimal degrees, 0 through 180. */
  degrees: number;
}

// ---------------------------------------------------------------------------
// GEDCOM 5.5.1 Chapter 3 — character sets
// ---------------------------------------------------------------------------

