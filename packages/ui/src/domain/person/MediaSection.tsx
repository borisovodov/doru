import { isImagePath, type MediaLinkRecord, type MediaRecord } from '@doru/core/model';
import { FileImage } from 'lucide-react';
import { useEffect, useState } from 'react';
import { nls } from '../../nls';
import { Button } from '../../atoms/button/Button';
import { EmptyText } from '../../atoms/feedback/EmptyText';
import { InlineError } from '../../atoms/feedback/InlineError';
import { AttachExisting } from '../../patterns/attach-existing/AttachExisting';
import { MediaTile } from '../../patterns/media-tile/MediaTile';
import { SectionCard } from '../../patterns/section-card/SectionCard';
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
  const [mediaError, setMediaError] = useState(false);

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
    setMediaError(false);
    try {
      await api.addMediaToTarget(targetType, targetId);
      await refresh();
      setAllMedia(await api.getAllMedia());
    } catch {
      setMediaError(true);
    }
  };

  const attach = async (mediaId: string) => {
    setMediaError(false);
    try {
      await api.attachMedia({ id: crypto.randomUUID(), mediaId, targetType, targetId });
      await refresh();
      setAllMedia(await api.getAllMedia());
    } catch (error) {
      setMediaError(true);
      throw error;
    }
  };

  const remove = async (item: MediaRecord) => {
    if (!window.confirm(nls.t('features.tree.media.deleteConfirm'))) {
      return;
    }
    setMediaError(false);
    try {
      await api.deleteMedia(item);
      await refresh();
      setAllMedia(await api.getAllMedia());
    } catch {
      setMediaError(true);
    }
  };

  const detach = async (item: MediaRecord) => {
    const link = item.links?.find((entry) => entry.targetType === targetType && entry.targetId === targetId);
    if (link === undefined) {
      return;
    }
    setMediaError(false);
    try {
      await api.detachMedia(link);
      await refresh();
      setAllMedia(await api.getAllMedia());
    } catch {
      setMediaError(true);
    }
  };

  const linkOf = (item: MediaRecord) =>
    item.links?.find((entry) => entry.targetType === targetType && entry.targetId === targetId);
  const hasResolvedFile = (item: MediaWithPath): boolean => (item.files ?? []).some((file) => file.absolutePath !== '');
  const visibleMedia = media
    .filter(hasResolvedFile)
    .slice()
    .sort((a, b) => Number(linkOf(b)?.primary === true) - Number(linkOf(a)?.primary === true));
  const attachable = allMedia.filter(
    (item) =>
      hasResolvedFile(item) &&
      !(item.links ?? []).some((link) => link.targetType === targetType && link.targetId === targetId),
  );

  return (
    <SectionCard title={nls.t('features.tree.media.title')}>
      {visibleMedia.length === 0 ? (
        <EmptyText>{nls.t('features.tree.media.empty')}</EmptyText>
      ) : (
        <div className={styles['grid']}>
          {visibleMedia.map((item) => {
            const link = linkOf(item);
            const shared = (item.links?.length ?? 0) > 1;
            const resolvedFile = item.files?.find((file) => file.absolutePath !== '');
            const preview =
              resolvedFile !== undefined && isImagePath(resolvedFile.path)
                ? `doru-media://local/?path=${encodeURIComponent(resolvedFile.absolutePath)}`
                : '';
            const badge =
              link?.primary === true
                ? nls.t('features.tree.media.primary')
                : link?.exclude === true
                  ? nls.t('features.tree.media.excluded')
                  : undefined;
            return (
              <MediaTile
                key={item.id}
                src={preview}
                alt={item.title ?? item.path ?? item.id}
                fallback={
                  <span className={styles['fallback']}>
                    <FileImage size={24} aria-hidden="true" />
                    <span>{item.title ?? item.path ?? item.id}</span>
                  </span>
                }
                {...(badge !== undefined ? { badge } : {})}
                {...(link?.exclude === true ? { muted: true } : {})}
                {...(onOpenMedia
                  ? {
                      openLabel: nls.t('features.tree.media.open'),
                      onOpen: () => onOpenMedia(item.id),
                    }
                  : {})}
                removeLabel={nls.t('features.tree.media.delete')}
                onRemove={() => void remove(item)}
                {...(shared
                  ? {
                      detachLabel: nls.t('features.tree.media.detach'),
                      onDetach: () => void detach(item),
                    }
                  : {})}
              />
            );
          })}
        </div>
      )}
      <div className={styles['actions']}>
        <Button variant="secondary" onClick={() => void add()}>
          {nls.t('features.tree.media.add')}
        </Button>
        <AttachExisting
          className={styles['attach']}
          label={nls.t('features.tree.media.attachExisting')}
          actionLabel={nls.t('features.tree.media.attach')}
          options={attachable.map((item) => ({
            id: item.id,
            label: item.title ?? item.path ?? item.id,
          }))}
          onAttach={attach}
        />
      </div>
      {mediaError ? <InlineError>{nls.t('features.tree.autosaveFailed')}</InlineError> : null}
    </SectionCard>
  );
}
