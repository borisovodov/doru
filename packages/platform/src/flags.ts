/**
 * Temporary feature switches.
 *
 * GEDCOM import and export stay implemented; while the tree schema and the
 * record cards are being reworked, their UI surfaces (menu items, shortcuts,
 * the file-picker filter and the shortcut hints) are hidden. Flip the flag
 * back to `true` to restore them.
 */
export const GEDCOM_INTEROP_VISIBLE: boolean = false;

/**
 * The Search sidebar stays implemented; until the search layer is ready, its
 * UI surfaces (the activity-bar entry, the keyboard shortcut and the shortcut
 * hint) are hidden. Flip the flag back to `true` to restore them.
 */
export const SEARCH_VISIBLE: boolean = false;
