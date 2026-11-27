import type { SubmitterLink, SubmitterRecord } from '@doru/core';
import { nls } from '../../nls';
import { SubmitterLinksSection } from './SubmitterLinksSection';

/**
 * GEDCOM `ANCI`/`DESI` research interests on a person: the submitters who are
 * researching the person's ancestors or descendants. This is provenance of
 * research intent, not a contribution to the record itself.
 */
export function ResearchInterestsSection({
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
  links: SubmitterLink[];
  onAdd: (submitterId: string, targetType: string, targetId: string, kind: SubmitterLink['kind']) => Promise<void>;
  onDelete: (
    id: string,
    submitterId: string,
    targetType: string,
    targetId: string,
    kind: SubmitterLink['kind'],
  ) => Promise<void>;
  canAdd?: boolean;
}) {
  return (
    <SubmitterLinksSection
      title={nls.t('features.tree.researchInterests.title')}
      addLabel={nls.t('features.tree.researchInterests.add')}
      emptyLabel={nls.t('features.tree.researchInterests.empty')}
      removeLabel={nls.t('features.tree.researchInterests.remove')}
      submitterFieldLabel={nls.t('features.tree.contributors.submitter')}
      kindFieldLabel={nls.t('features.tree.researchInterests.kind')}
      targetType={targetType}
      targetId={targetId}
      submitters={submitters}
      links={links}
      kinds={['ancestor_interest', 'descendant_interest']}
      defaultKind="ancestor_interest"
      showKindLabel
      onAdd={onAdd}
      onDelete={onDelete}
      canAdd={canAdd}
    />
  );
}
