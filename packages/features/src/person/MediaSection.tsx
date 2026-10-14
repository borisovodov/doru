import type { MediaRecord } from '@doru/core';
import { nls } from '../nls';
import type { MediaWithPath } from './types';
import './MediaSection.css';

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
    <div className="person-section">
      <h3>{nls.t('features.tree.media.title')}</h3>
      {media.length === 0 ? (
        <p className="notes-empty">{nls.t('features.tree.media.empty')}</p>
      ) : (
        <div className="media-grid">
          {media.map((item) => (
            <figure key={item.id} className="media-item">
              <img
                src={`doru-media://local/?path=${encodeURIComponent(item.absolutePath)}`}
                alt={item.caption ?? ''}
                loading="lazy"
              />
              <button
                className="media-remove"
                title={nls.t('features.tree.media.remove')}
                onClick={() => void remove(item)}
              >
                ×
              </button>
            </figure>
          ))}
        </div>
      )}
      <button onClick={() => void add()}>{nls.t('features.tree.media.add')}</button>
    </div>
  );
}
