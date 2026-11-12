import type { ChangeRecord } from '@doru/core';
import { nls } from '../../nls';
import { formatDate } from '../format/format';
import { SectionCard } from '../../patterns/section-card/SectionCard';
import { EmptyText } from '../../atoms/feedback/EmptyText';
import { AttachmentRow, RowList } from '../../patterns/row-list/RowList';

/** The read-only change log of an entity (created/changed rows). */
export function ChangesSection({ changes }: { changes: ChangeRecord[] }) {
  return (
    <SectionCard title={nls.t('features.tree.history.title')}>
      {changes.length === 0 ? (
        <EmptyText>{nls.t('features.tree.history.empty')}</EmptyText>
      ) : (
        <RowList>
          {changes.map((change) => (
            <AttachmentRow
              key={change.id}
              kind={
                change.kind === 'created'
                  ? nls.t('features.tree.history.created')
                  : nls.t('features.tree.history.changed')
              }
              value={
                <>
                  {change.date ? formatDate(change.date) : ''}
                  {change.user ? ` — ${change.user}` : ''}
                </>
              }
            />
          ))}
        </RowList>
      )}
    </SectionCard>
  );
}
