/**
 * The MyHeritage `_PUBLISH` record: the site a tree was published to.
 *
 * `0 _PUBLISH` starts a record describing the MyHeritage family site
 * the tree was published to, with the `_SITEADDRESS` (the site's URL
 * name), `_SITENAME`, `_SITEID`, `_USERNAME` and the `_DISABLED`
 * flag. The meaning and wire shape come from real MyHeritage exports
 * (e.g. `HEAD.DEST MYHERITAGE` files); not part of any GEDCOM version.
 * Recognized on input and written back as `_PUBLISH` in both versions.
 */

import type { Text, Xref } from '../primitives';
import type { GedcomStructureBase } from './extensions';

export interface PublishedSiteRecord extends GedcomStructureBase {
  tag: '_PUBLISH';
  /** The record's cross-reference identifier (@…@); optional when nothing points to it. */
  xref?: Xref;
  /** _SITEADDRESS {0:1} — the address of the published site. */
  siteAddress?: Text;
  /** _SITENAME {0:1} — the name of the published site. */
  siteName?: Text;
  /** _SITEID {0:1} — the identifier of the published site. */
  siteId?: Text;
  /** _USERNAME {0:1} — the publishing account's user name. */
  username?: Text;
  /** _DISABLED {0:1} — the publication was disabled (a presence flag). */
  disabled?: boolean;
}
