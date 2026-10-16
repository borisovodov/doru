# GEDCOM 5.5.1 overlay notes

The TypeScript model in `src/` is a single model spanning GEDCOM 5.5.1 and
GEDCOM 7.0.18. This file records how the places where the two
specifications disagree were resolved.

Conventions: 7.0 references are `GEDCOM 7.0 §…`, 5.5.1 references are
`GEDCOM 5.5.1 §2 (p.…)` (chapter 2: record structures p.23, substructures
p.31, primitive elements p.41).

## Resolved conflicts

1. **Name and place variants.** 5.5.1 uses FONE (phonetic) and ROMN
   (romanized) substructures with a required TYPE holding the method
   (kana, hangul, pinyin, romaji, wadegiles, user-defined); 7.0 uses TRAN
   with a required BCP 47 LANG. The model keeps both: `translations`
   (7.0) plus `phonetic` / `romanized` arrays (5.5.1) on
   `PersonalNameStructure` and `PlaceStructure`.

2. **Association relation.** 5.5.1 states the association with RELA
   (free text); 7.0 with ROLE (enumeration) + PHRASE. The model has both:
   `relationship?: Text` (5.5.1) and `role?: RoleStructure` (7.0); each
   version fills exactly one.

3. **Free-text source citation.** 5.5.1 permits a SOUR citation whose
   payload is a free-text description instead of an xref. The model adds
   `description?: Text` to `SourceCitation`; `source` stays required.

4. **Age keywords.** 5.5.1 AGE_AT_EVENT allows the keywords CHILD
   (< 8 years), INFANT (< 1 year) and STILLBORN in addition to the numeric
   counts; 7.0 has only numeric counts (plus weeks). The model adds
   `description?: 'CHILD' | 'INFANT' | 'STILLBORN'` to `AgeValue`.

5. **Family residence.** FAM.RESI is a family event without a payload in
   5.5.1 and a family attribute with a Text payload in 7.0. The model
   keeps a single `FamilyResidenceAttribute` whose payload is optional
   (required in 7.0, forbidden in 5.5.1).

6. **Address contacts.** 5.5.1 keeps PHON/EMAIL/FAX/WWW {0:3} inside the
   ADDRESS_STRUCTURE; 7.0 moved them to the record level (REPO, SUBM,
   HEAD.SOUR.CORP) and into EVENT_DETAIL. The model has both: optional
   `phone`/`email`/`fax`/`www` arrays on `AddressStructure` (5.5.1) and
   the 7.0 record-level fields.

7. **LDS ordinance statuses.** 5.5.1 defines four per-ordinance value
   sets and spells PRE-1970 and DNS/CAN with a hyphen and slash; 7.0 has
   one unified set with PRE_1970 and DNS_CAN plus the new INFANT value.
   The model keeps the single 7.0 union; the 5.5.1 spellings are
   serialization aliases and the per-ordinance subsets are enforced at
   validation time, not in the types.

8. **Dates.** 5.5.1 writes the calendar as an `@#D…@` escape, the BCE era
   as a trailing `B.C.`, the interpreted form `INT date (phrase)` and the
   dual-year `1648/49`; 7.0 uses calendar keywords, the BCE epoch, and the
   PHRASE substructure. The model is unchanged: the `DateValue` union
   covers both semantics, and the syntax differences are handled by the
   parser/serializer (INT-phrases and dual years map to `phrase`).

9. **Inline multimedia link.** 5.5.1 permits an inline OBJE (no pointer,
   FILE/FORM/MEDI/TITL directly beneath it); 7.0 only allows a pointer to
   a MULTIMEDIA_RECORD. The model keeps the 7.0 pointer-only shape: on
   import, an inline 5.5.1 OBJE is normalized by synthesizing a
   MULTIMEDIA_RECORD from its files. Media bytes are always external in
   both versions (5.5.1 removed its BLOB embedding form).
