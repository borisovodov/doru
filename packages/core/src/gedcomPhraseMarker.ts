/**
 * Prefix of the NOTE payload that carries an adoption family-link phrase when
 * no adopting parent is selected. GEDCOM's ADOP substructure requires an
 * adopting-parent enum before it can hold a PHRASE, so a phrase-only link has
 * no standard slot; the paired importer moves this note back onto the link.
 */
export const ADOPTION_PHRASE_PREFIX = '_DORU_ADOP_PHRASE: ';
