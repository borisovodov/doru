import { describe, expect, it } from 'vitest';
import {
  ATTACHMENT_TARGET_TYPES,
  CITATION_TARGET_TYPES,
  CONTACT_TARGET_TYPES,
  MEDIA_LINK_TARGET_TYPES,
  NOTE_TARGET_TYPES,
  RECORD_SUBMITTER_TARGET_TYPES,
  TASK_LINK_TARGET_TYPES,
  isAttachmentTargetAllowed,
  type AttachmentTargetKind,
} from '../src/model/targetPolicy';

/**
 * The complete target vocabulary, written out in the test so the policy test
 * cannot be satisfied by deriving the expected list from the implementation.
 */
const ALL_TARGET_TYPES = [
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

const FAMILIES: Array<[AttachmentTargetKind, readonly string[]]> = [
  ['note', NOTE_TARGET_TYPES],
  ['citation', CITATION_TARGET_TYPES],
  ['mediaLink', MEDIA_LINK_TARGET_TYPES],
  ['contact', CONTACT_TARGET_TYPES],
  ['taskLink', TASK_LINK_TARGET_TYPES],
  ['recordSubmitter', RECORD_SUBMITTER_TARGET_TYPES],
];

describe('attachment target policy', () => {
  it.each(FAMILIES)('has no duplicate target types in %s', (_kind, types) => {
    expect(new Set(types).size).toBe(types.length);
  });

  it('covers every target type across the families and nothing else', () => {
    const covered = new Set(Object.values(ATTACHMENT_TARGET_TYPES).flat());
    expect([...covered].sort()).toEqual([...ALL_TARGET_TYPES].sort());
  });

  it.each([
    ['note', 'person', true],
    ['note', 'task', true],
    ['note', 'media_link', false],
    ['note', 'note', false],
    ['citation', 'media', true],
    ['citation', 'submitter', true],
    ['citation', 'citation', false],
    ['citation', 'media_link', false],
    ['citation', 'task', false],
    ['citation', 'note', false],
    ['mediaLink', 'task', true],
    ['mediaLink', 'citation', true],
    ['mediaLink', 'media', false],
    ['mediaLink', 'media_link', false],
    ['mediaLink', 'note', false],
    ['contact', 'person', true],
    ['contact', 'fact', true],
    ['contact', 'repository', true],
    ['contact', 'submitter', true],
    ['contact', 'address', false],
    ['contact', 'task', false],
    ['contact', 'family', false],
    ['taskLink', 'source', true],
    ['taskLink', 'task', false],
    ['taskLink', 'submitter', false],
    ['taskLink', 'media_link', false],
    ['recordSubmitter', 'person', true],
    ['recordSubmitter', 'submitter', false],
    ['recordSubmitter', 'task', false],
    ['recordSubmitter', 'media_link', false],
  ] satisfies Array<[AttachmentTargetKind, string, boolean]>)('allows %s → %s: %s', (kind, targetType, allowed) => {
    expect(isAttachmentTargetAllowed(kind, targetType)).toBe(allowed);
  });
});
