/**
 * The per-family target policies for the polymorphic attachment tables. Every
 * set is written out in full even where the lists look alike: the duplication
 * is deliberate so a reader sees at a glance what one link family allows
 * without reconstructing it from a shared list.
 *
 * A target type that is absent from a family's set must not receive that
 * family's attachment rows. Both the service guards and the UI section
 * visibility read these sets; there is no second allowed-target list.
 */

/** Targets a note link may point at. */
export const NOTE_LINK_TARGET_TYPES = [
  'person',
  'family',
  'family_partner',
  'family_child',
  'family_marriage_status',
  'fact',
  'name',
  'name_part',
  'source',
  'citation',
  'media',
  'media_file',
  'place',
  'place_name',
  'place_hierarchy',
  'repository',
  'submitter',
  'address',
  'address_line',
  'association',
  'task',
  'title',
] as const;

/** Targets a source citation may point at. A task is not an assertion. */
export const CITATION_TARGET_TYPES = [
  'person',
  'family',
  'family_partner',
  'family_child',
  'family_marriage_status',
  'fact',
  'name',
  'name_part',
  'source',
  'citation',
  'media',
  'media_file',
  'media_link',
  'place',
  'place_name',
  'place_hierarchy',
  'repository',
  'submitter',
  'address',
  'address_line',
  'association',
  'title',
] as const;

/** Targets a media link may point at. */
export const MEDIA_LINK_TARGET_TYPES = [
  'person',
  'family',
  'family_partner',
  'family_child',
  'family_marriage_status',
  'fact',
  'name',
  'name_part',
  'source',
  'citation',
  'media',
  'media_file',
  'place',
  'place_name',
  'place_hierarchy',
  'repository',
  'submitter',
  'address',
  'address_line',
  'association',
  'task',
  'title',
] as const;

/**
 * Targets that can own contact details. GEDCOM keeps PHON, EMAIL, FAX and WWW
 * inside addresses (5.5.x), on event details and on the REPO and SUBM records
 * (7.0); direct INDI contacts are a vendor extension Dóru keeps on a person.
 */
export const CONTACT_TARGET_TYPES = ['person', 'fact', 'address', 'repository', 'submitter'] as const;

/** Targets a task link may point at. */
export const TASK_LINK_TARGET_TYPES = [
  'person',
  'family',
  'family_partner',
  'family_child',
  'family_marriage_status',
  'fact',
  'name',
  'name_part',
  'source',
  'citation',
  'media',
  'media_file',
  'place',
  'place_name',
  'place_hierarchy',
  'repository',
  'address',
  'address_line',
  'association',
  'title',
] as const;

/** Targets a contributor or research-interest record link may point at. */
export const RECORD_SUBMITTER_TARGET_TYPES = [
  'person',
  'family',
  'family_partner',
  'family_child',
  'family_marriage_status',
  'fact',
  'name',
  'name_part',
  'source',
  'citation',
  'media',
  'media_file',
  'place',
  'place_name',
  'place_hierarchy',
  'repository',
  'submitter',
  'address',
  'address_line',
  'association',
  'title',
] as const;

/** Every polymorphic attachment family, keyed by its link kind. */
export const ATTACHMENT_TARGET_TYPES = {
  noteLink: NOTE_LINK_TARGET_TYPES,
  citation: CITATION_TARGET_TYPES,
  mediaLink: MEDIA_LINK_TARGET_TYPES,
  contact: CONTACT_TARGET_TYPES,
  taskLink: TASK_LINK_TARGET_TYPES,
  recordSubmitter: RECORD_SUBMITTER_TARGET_TYPES,
} as const;

/** The polymorphic attachment families. */
export type AttachmentTargetKind = keyof typeof ATTACHMENT_TARGET_TYPES;

/** Every target type used by at least one attachment family. */
export type TargetType = (typeof ATTACHMENT_TARGET_TYPES)[keyof typeof ATTACHMENT_TARGET_TYPES][number];

/** Whether one attachment family may point at the given target type. */
export function isAttachmentTargetAllowed(kind: AttachmentTargetKind, targetType: string): boolean {
  return (ATTACHMENT_TARGET_TYPES[kind] as readonly string[]).includes(targetType);
}
