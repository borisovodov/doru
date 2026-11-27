import type { RecordSubmitterLink, SubmitterRecord } from '@doru/core';
import { nls } from '../../nls';
import { SubmitterLinksSection } from './SubmitterLinksSection';

/**
 * The submitters who contributed a record (GEDCOM SUBM): chips with the
 * submitter names, an add picker and per-chip removal. Research interests
 * (`ANCI`/`DESI`) are shown separately by ResearchInterestsSection.
 */
export function ContributorsSection({
  targetType,
  targetId,
  submitters,
  links,
  onAdd,
  onDelete,
  canAdd = true,
}: {
  targetType: string;
  targetId: string;
  submitters: SubmitterRecord[];
  links: RecordSubmitterLink[];
  onAdd: (
    submitterId: string,
    targetType: string,
    targetId: string,
    kind: RecordSubmitterLink['kind'],
  ) => Promise<void>;
  onDelete: (
    id: string,
    submitterId: string,
    targetType: string,
    targetId: string,
    kind: RecordSubmitterLink['kind'],
  ) => Promise<void>;
  /** False when the caller wants a read-only list of legacy links. */
  canAdd?: boolean;
}) {
  return (
    <SubmitterLinksSection
      title={nls.t('features.tree.contributors.title')}
      addLabel={nls.t('features.tree.contributors.add')}
      emptyLabel={nls.t('features.tree.contributors.empty')}
      removeLabel={nls.t('features.tree.contributors.remove')}
      submitterFieldLabel={nls.t('features.tree.contributors.submitter')}
      targetType={targetType}
      targetId={targetId}
      submitters={submitters}
      links={links}
      kinds={['contributor']}
      defaultKind="contributor"
      showKindLabel={false}
      onAdd={onAdd}
      onDelete={onDelete}
      canAdd={canAdd}
    />
  );
}
