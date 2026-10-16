/**
 * Primitives of the GEDCOM 7.0.18 object model.
 *
 * Every type in this file maps to a concept of the FamilySearch GEDCOM
 * Specification 7.0.18; every section reference (`GEDCOM 7.0 §…`) in this
 * file points into that specification: chapter 1 (container format
 * identifiers), chapter 2 (data types) and chapter 6 (known calendars).
 * Chapter numbers differ between GEDCOM versions (5.5.1 numbers its
 * chapters differently), so the version is always stated explicitly in
 * every reference.
 */

// ---------------------------------------------------------------------------
// GEDCOM 7.0 §1.3 Lines — identifiers and tags
// ---------------------------------------------------------------------------

/**
 * GEDCOM 7.0 §1.3 Lines, production `Xref` — a cross-reference identifier `@...@`.
 * Each cross-reference identifier is unique within a given document and is
 * not retained between data streams.
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
 */
export type Pointer<_TRecord> = Xref | VoidPointer;

/**
 * GEDCOM 7.0 §1.3 Lines, production `stdTag` — a standard tag: an uppercase letter
 * followed by any number of uppercase letters, digits, and underscores.
 */
export type StdTag = string;

/**
 * GEDCOM 7.0 §1.3 Lines, production `extTag` — an extension tag: an underscore
 * followed by one or more tag characters (uppercase letters, digits,
 * underscores).
 */
export type ExtensionTag = `_${string}`;

/**
 * GEDCOM 7.0 §1.3 Lines, production `Tag` — a tag, either standard or extension.
 */
export type Tag = StdTag | ExtensionTag;

// ---------------------------------------------------------------------------
// GEDCOM 7.0 §2.1 Text
// ---------------------------------------------------------------------------

/**
 * GEDCOM 7.0 §2.1 Text — a free-text string in a human language: an unconstrained
 * sequence of characters (any character except the banned characters of
 * GEDCOM 7.0 §1.1). URI: `xsd:string`.
 */
export type Text = string;

// ---------------------------------------------------------------------------
// GEDCOM 7.0 §2.2 Integer
// ---------------------------------------------------------------------------

/**
 * GEDCOM 7.0 §2.2 Integer — a non-negative integer in base-10. Negative integers are
 * not supported by the specification; leading zeros have no semantic
 * meaning. URI: `xsd:nonNegativeInteger`.
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
 */
export type EnumValue = StdEnum | ExtensionTag;

// ---------------------------------------------------------------------------
// GEDCOM 7.0 §2.4 Date
// ---------------------------------------------------------------------------

/**
 * GEDCOM 7.0 §2.4 Date, production `calendar` — a calendar name. The four standard
 * calendars are defined in GEDCOM 7.0 §6.1; extension calendars use extension tags.
 */
export type Calendar = 'GREGORIAN' | 'JULIAN' | 'FRENCH_R' | 'HEBREW' | ExtensionTag;

/**
 * GEDCOM 7.0 §6.1 GREGORIAN — the months permitted in the Gregorian calendar. The
 * same months are permitted in the JULIAN calendar (GEDCOM 7.0 §6.1 JULIAN). Each
 * month has the URI `g7:month-<tag>`.
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
 */
export type Epoch = 'BCE' | ExtensionTag;

/**
 * GEDCOM 7.0 §2.4 Date, production `date` — a single calendar date. An absent
 * calendar is equivalent to GREGORIAN. Every date must have a year; day
 * and month are optional.
 */
export interface DateFields {
  /** GEDCOM 7.0 §2.4 — `[calendar D]`, optional; absent means GREGORIAN. */
  calendar?: Calendar;
  /** GEDCOM 7.0 §2.4 — `day`, optional; 1 to a month-specific maximum. */
  day?: Integer;
  /** GEDCOM 7.0 §2.4 — `month`, optional; constrained by the calendar (GEDCOM 7.0 §6.1). */
  month?: GedcomMonth;
  /** GEDCOM 7.0 §2.4 — `year`, required: `year = Integer`. */
  year: Integer;
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
 */
export interface AgeValue {
  /** GEDCOM 7.0 §2.6 — `[ageBound D]`, optional. */
  bound?: AgeBound;
  /** GEDCOM 7.0 §2.6 — `years = Integer "y"`, optional. */
  years?: Integer;
  /** GEDCOM 7.0 §2.6 — `months = Integer "m"`, optional. */
  months?: Integer;
  /** GEDCOM 7.0 §2.6 — `weeks = Integer "w"`, optional. */
  weeks?: Integer;
  /** GEDCOM 7.0 §2.6 — `days = Integer "d"`, optional. */
  days?: Integer;
}

// ---------------------------------------------------------------------------
// GEDCOM 7.0 §2.7 List
// ---------------------------------------------------------------------------

/**
 * GEDCOM 7.0 §2.7 List — `List:Text`: a sequence of Text values, serialized
 * comma-separated. URI: `g7:type-List#Text`.
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
 */
export type Language = string;

// ---------------------------------------------------------------------------
// GEDCOM 7.0 §2.10 Media Type
// ---------------------------------------------------------------------------

/**
 * GEDCOM 7.0 §2.10 Media Type — the encoding of information in bytes or characters,
 * as defined in RFC 2045 section 5.1 and registered by the IANA.
 * URI: `dcat:mediaType`.
 */
export type MediaType = string;

// ---------------------------------------------------------------------------
// GEDCOM 7.0 §2.11 Special
// ---------------------------------------------------------------------------

/**
 * GEDCOM 7.0 §2.11 Special — a string conforming to a case-specific standard or
 * constraints unique to the structure type using it (for example, the
 * payload of an IDNO structure depends on its TYPE substructure).
 * URI: `xsd:string`.
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
 */
export interface Longitude {
  /** GEDCOM 7.0 §2.16 — `E` east of the prime meridian, `W` west of it. */
  direction: 'E' | 'W';
  /** GEDCOM 7.0 §2.16 — decimal degrees, 0 through 180. */
  degrees: number;
}
