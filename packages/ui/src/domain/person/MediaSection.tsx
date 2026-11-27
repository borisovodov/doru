import {
  isExternalMediaPath,
  isImagePath,
  mediaDisplayName,
  type MediaLinkRecord,
  type MediaRecord,
} from '@doru/core/model';
import { FileImage } from 'lucide-react';
import { useEffect, useState } from 'react';
import { nls } from '../../nls';
import { EmptyText } from '../../atoms/feedback/EmptyText';
import { InlineError } from '../../atoms/feedback/InlineError';
import { AttachExisting } from '../../patterns/attach-existing/AttachExisting';
import { MediaTile } from '../../patterns/media-tile/MediaTile';
import { SectionCard } from '../../patterns/section-card/SectionCard';
import { MediaAddControl } from '../media/MediaAddControl';
import type { MediaWithPath } from './types';
import styles from './MediaSection.module.css';

/** The media operations an entity editor needs for one target. */
export interface MediaSectionApi {
  getMediaFor(targetType: string, targetId: string): Promise<MediaWithPath[]>;
  getAllMedia(): Promise<MediaWithPath[]>;
  addMediaToTarget(targetType: string, targetId: string): Promise<void>;
  addMediaUrlToTarget(targetType: string, targetId: string, url: string): Promise<void>;
  attachMedia(link: MediaLinkRecord): Promise<void>;
  updateMediaLink(before: MediaLinkRecord, after: MediaLinkRecord): Promise<void>;
  detachMedia(link: MediaLinkRecord): Promise<void>;
  deleteMedia(media: MediaRecord): Promise<void>;
}

function mediaList(items: MediaWithPath[] | undefined): MediaWithPath[] {
  return items ?? [];
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
        setAllMedia(mediaList(loaded));
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
      setAllMedia(mediaList(await api.getAllMedia()));
    } catch {
      setMediaError(true);
    }
  };

  const addUrl = async (url: string) => {
    setMediaError(false);
    await api.addMediaUrlToTarget(targetType, targetId, url);
    try {
      await refresh();
      setAllMedia(mediaList(await api.getAllMedia()));
    } catch {
      // The record is committed; a stale list must not prompt a duplicate add.
      setMediaError(true);
    }
  };

  const attach = async (mediaId: string) => {
    setMediaError(false);
    try {
      await api.attachMedia({ id: crypto.randomUUID(), mediaId, targetType, targetId });
      await refresh();
      setAllMedia(mediaList(await api.getAllMedia()));
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
      setAllMedia(mediaList(await api.getAllMedia()));
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
      setAllMedia(mediaList(await api.getAllMedia()));
    } catch {
      setMediaError(true);
    }
  };

  const makePrimary = async (item: MediaRecord) => {
    const link = item.links?.find((entry) => entry.targetType === targetType && entry.targetId === targetId);
    if (link === undefined || link.primary === true) {
      return;
    }
    setMediaError(false);
    try {
      await api.updateMediaLink(link, { ...link, primary: true });
      await refresh();
    } catch {
      setMediaError(true);
    }
  };

  const linkOf = (item: MediaRecord) =>
    item.links?.find((entry) => entry.targetType === targetType && entry.targetId === targetId);
  const hasDisplayableFile = (item: MediaWithPath): boolean =>
    item.absolutePath !== '' || isExternalMediaPath(item.path);
  const visibleMedia = media.filter(hasDisplayableFile).slice();
  // The stored flag wins; older projects that predate the primary invariant
  // still show exactly one main photo, the first visible one.
  const primaryMedia = visibleMedia.find((item) => linkOf(item)?.primary === true) ?? visibleMedia[0];
  const orderedMedia =
    primaryMedia === undefined
      ? visibleMedia
      : [primaryMedia, ...visibleMedia.filter((item) => item.id !== primaryMedia.id)];
  const attachable = allMedia.filter(
    (item) =>
      hasDisplayableFile(item) &&
      !(item.links ?? []).some((link) => link.targetType === targetType && link.targetId === targetId),
  );

  return (
    <SectionCard title={nls.t('features.tree.media.title')}>
      {visibleMedia.length === 0 ? (
        <EmptyText>{nls.t('features.tree.media.empty')}</EmptyText>
      ) : (
        <div className={styles['grid']}>
          {orderedMedia.map((item) => {
            const isPrimary = item.id === primaryMedia?.id;
            const preview =
              item.absolutePath !== '' && isImagePath(item.path)
                ? `doru-media://local/?path=${encodeURIComponent(item.absolutePath)}`
                : '';
            const label = mediaDisplayName(item) ?? item.path;
            return (
              <MediaTile
                key={item.id}
                src={preview}
                alt={label}
                fallback={
                  <span className={styles['fallback']}>
                    <FileImage size={24} aria-hidden="true" />
                    <span>{label}</span>
                  </span>
                }
                primary={isPrimary}
                primaryLabel={
                  isPrimary ? nls.t('features.tree.media.primary') : nls.t('features.tree.media.makePrimary')
                }
                {...(isPrimary ? {} : { onPrimary: () => void makePrimary(item) })}
                {...(onOpenMedia
                  ? {
                      openLabel: nls.t('features.tree.media.open'),
                      onOpen: () => onOpenMedia(item.id),
                    }
                  : {})}
                removeLabel={nls.t('features.tree.media.delete')}
                onRemove={() => void remove(item)}
                detachLabel={nls.t('features.tree.media.detach')}
                onDetach={() => void detach(item)}
              />
            );
          })}
        </div>
      )}
      <div className={styles['actions']}>
        <MediaAddControl label={nls.t('features.tree.media.add')} onAddFiles={() => void add()} onAddUrl={addUrl} />
        <AttachExisting
          className={styles['attach']}
          label={nls.t('features.tree.media.attachExisting')}
          actionLabel={nls.t('features.tree.media.attach')}
          options={attachable.map((item) => ({
            id: item.id,
            label: mediaDisplayName(item) ?? item.path,
          }))}
          onAttach={attach}
        />
      </div>
      {mediaError ? <InlineError>{nls.t('features.tree.autosaveFailed')}</InlineError> : null}
    </SectionCard>
  );
}
