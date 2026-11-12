import type { MediaRecord } from '@doru/core';
import { nls } from '../../nls';
import { Button } from '../../atoms/button/Button';
import { EmptyText } from '../../atoms/feedback/EmptyText';
import { MediaTile } from '../../patterns/media-tile/MediaTile';
import { SectionCard } from '../../patterns/section-card/SectionCard';
import type { MediaWithPath } from './types';

export function MediaSection({
  personId,
  media,
  refresh,
  onAddMedia,
  onDeleteMedia,
}: {
  personId: string;
  media: MediaWithPath[];
  refresh: () => Promise<void>;
  onAddMedia: (personId: string) => Promise<void>;
  onDeleteMedia: (media: MediaRecord) => Promise<void>;
}) {
  const add = async () => {
    await onAddMedia(personId);
    await refresh();
  };

  const remove = async (item: MediaRecord) => {
    await onDeleteMedia(item);
    await refresh();
  };

  return (
    <SectionCard title={nls.t('features.tree.media.title')}>
      {media.length === 0 ? (
        <EmptyText>{nls.t('features.tree.media.empty')}</EmptyText>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '8px 0' }}>
          {media.map((item) => (
            <MediaTile
              key={item.id}
              src={`doru-media://local/?path=${encodeURIComponent(item.absolutePath)}`}
              alt={item.title ?? ''}
              removeLabel={nls.t('features.tree.media.remove')}
              onRemove={() => void remove(item)}
            />
          ))}
        </div>
      )}
      <Button variant="primary" onClick={() => void add()}>
        {nls.t('features.tree.media.add')}
      </Button>
    </SectionCard>
  );
}
