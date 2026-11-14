import type { MediaLinkRecord, MediaRecord } from '@doru/core';
import { useEffect, useState } from 'react';
import { nls } from '../../nls';
import { Button } from '../../atoms/button/Button';
import { EmptyText } from '../../atoms/feedback/EmptyText';
import { MediaTile } from '../../patterns/media-tile/MediaTile';
import { SectionCard } from '../../patterns/section-card/SectionCard';
import { Select } from '../../atoms/form/Select';
import type { MediaWithPath } from './types';
import styles from './MediaSection.module.css';

/** The media operations an entity editor needs for one target. */
export interface MediaSectionApi {
  getMediaFor(targetType: string, targetId: string): Promise<MediaWithPath[]>;
  getAllMedia(): Promise<MediaWithPath[]>;
  addMediaToTarget(targetType: string, targetId: string): Promise<void>;
  attachMedia(link: MediaLinkRecord): Promise<void>;
  detachMedia(link: MediaLinkRecord): Promise<void>;
  deleteMedia(media: MediaRecord): Promise<void>;
}

export function MediaSection({
  targetType,
  targetId,
  media,
  api,
  refresh,
  onOpenMedia,
}: {
  targetType: string;
  targetId: string;
  media: MediaWithPath[];
  api: MediaSectionApi;
  refresh: () => Promise<void>;
  onOpenMedia?: ((mediaId: string) => void) | undefined;
}) {
  const [allMedia, setAllMedia] = useState<MediaWithPath[]>([]);
  const [attachId, setAttachId] = useState('');

  useEffect(() => {
    let cancelled = false;
    void api.getAllMedia().then((loaded) => {
      if (!cancelled) {
        setAllMedia(loaded);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [api]);

  const add = async () => {
    await api.addMediaToTarget(targetType, targetId);
    await refresh();
    setAllMedia(await api.getAllMedia());
  };

  const attach = async () => {
    if (attachId === '') {
      return;
    }
    await api.attachMedia({ id: crypto.randomUUID(), mediaId: attachId, targetType, targetId });
    setAttachId('');
    await refresh();
    setAllMedia(await api.getAllMedia());
  };

  const remove = async (item: MediaRecord) => {
    const link = item.links?.find((entry) => entry.targetType === targetType && entry.targetId === targetId);
    if (link !== undefined && (item.links?.length ?? 0) > 1) {
      await api.detachMedia(link);
    } else {
      await api.deleteMedia(item);
    }
    await refresh();
    setAllMedia(await api.getAllMedia());
  };

  const attachable = allMedia.filter(
    (item) => !(item.links ?? []).some((link) => link.targetType === targetType && link.targetId === targetId),
  );

  return (
    <SectionCard title={nls.t('features.tree.media.title')}>
      {media.length === 0 ? (
        <EmptyText>{nls.t('features.tree.media.empty')}</EmptyText>
      ) : (
        <div className={styles['grid']}>
          {media.map((item) => (
            <MediaTile
              key={item.id}
              src={`doru-media://local/?path=${encodeURIComponent(item.absolutePath)}`}
              alt={item.title ?? ''}
              {...(onOpenMedia
                ? {
                    openLabel: nls.t('features.tree.media.open'),
                    onOpen: () => onOpenMedia(item.id),
                  }
                : {})}
              removeLabel={nls.t('features.tree.media.remove')}
              onRemove={() => void remove(item)}
            />
          ))}
        </div>
      )}
      <div className={styles['actions']}>
        <Button variant="primary" onClick={() => void add()}>
          {nls.t('features.tree.media.add')}
        </Button>
        {attachable.length > 0 && (
          <>
            <Select value={attachId} onChange={(event) => setAttachId(event.target.value)}>
              <option value="">{nls.t('features.tree.media.attachExisting')}</option>
              {attachable.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title ?? item.path ?? item.id}
                </option>
              ))}
            </Select>
            <Button variant="secondary" disabled={attachId === ''} onClick={() => void attach()}>
              {nls.t('features.tree.media.attach')}
            </Button>
          </>
        )}
      </div>
    </SectionCard>
  );
}
