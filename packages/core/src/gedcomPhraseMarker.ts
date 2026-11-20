/**
 * Extension tag that carries an adoption family-link phrase when no adopting
 * parent is selected. GEDCOM's ADOP substructure requires an adopting-parent
 * enum before it can hold a PHRASE, so a phrase-only link has no standard
 * slot; the paired importer moves this extension back onto the link.
 */
export const ADOPTION_PHRASE_TAG = '_DORU_ADOP';
