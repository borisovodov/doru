import { isImagePath, TARGET_TYPES, type MediaLinkRecord, type MediaRecord, type TargetRef } from '@doru/core/model';
import { FileImage } from 'lucide-react';
import { useEffect, useState } from 'react';
import { nls } from '../../nls';
import { Button } from '../../atoms/button/Button';
import { EmptyText } from '../../atoms/feedback/EmptyText';
import { MediaTile } from '../../patterns/media-tile/MediaTile';
import { SectionCard } from '../../patterns/section-card/SectionCard';
import { Select } from '../../atoms/form/Select';
import type { MediaWithPath } from './types';
import { TargetPicker } from '../targets';
import styles from './MediaSection.module.css';

/** The media operations an entity editor needs for one target. */
export interface MediaSectionApi {
  getMediaFor(targetType: string, targetId: string): Promise<MediaWithPath[]>;
  getAllMedia(): Promise<MediaWithPath[]>;
  addMediaToTarget(targetType: string, targetId: string): Promise<void>;
  addMediaToTargets?(targets: TargetRef[]): Promise<void>;
  attachMedia(link: MediaLinkRecord): Promise<void>;
  attachMediaToTargets?(mediaId: string, targets: TargetRef[]): Promise<void>;
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
  const [extraTargets, setExtraTargets] = useState<TargetRef[]>([]);

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
    const submitted = extraTargets;
    if (submitted.length > 0 && api.addMediaToTargets === undefined) {
      return;
    }
    if (api.addMediaToTargets !== undefined) {
      await api.addMediaToTargets([{ targetType, targetId }, ...submitted]);
      setExtraTargets((current) => current.filter((target) => !containsTarget(submitted, target)));
    } else {
      await api.addMediaToTarget(targetType, targetId);
    }
    await refresh();
    setAllMedia(await api.getAllMedia());
  };

  const attach = async () => {
    if (attachId === '') {
      return;
    }
    const submitted = extraTargets;
    if (submitted.length > 0 && api.attachMediaToTargets === undefined) {
      return;
    }
    if (api.attachMediaToTargets !== undefined) {
      await api.attachMediaToTargets(attachId, [{ targetType, targetId }, ...submitted]);
      setExtraTargets((current) => current.filter((target) => !containsTarget(submitted, target)));
    } else {
      await api.attachMedia({ id: crypto.randomUUID(), mediaId: attachId, targetType, targetId });
    }
    setAttachId('');
    await refresh();
    setAllMedia(await api.getAllMedia());
  };

  const remove = async (item: MediaRecord) => {
    const link = item.links?.find((entry) => entry.targetType === targetType && entry.targetId === targetId);
    if (link !== undefined && (item.links?.length ?? 0) > 1) {
      await api.detachMedia(link);
    } else {
      if (!window.confirm(nls.t('features.tree.media.deleteConfirm'))) {
        return;
      }
      await api.deleteMedia(item);
    }
    await refresh();
    setAllMedia(await api.getAllMedia());
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
                removeLabel={nls.t('features.tree.media.remove')}
                onRemove={() => void remove(item)}
              />
            );
          })}
        </div>
      )}
      {(api.addMediaToTargets !== undefined || api.attachMediaToTargets !== undefined) && (
        <TargetPicker
          allowedTypes={TARGET_TYPES}
          value={extraTargets}
          onChange={setExtraTargets}
          ariaLabel={nls.t('features.tasks.target')}
        />
      )}
      <div className={styles['actions']}>
        <Button
          variant="primary"
          disabled={extraTargets.length > 0 && api.addMediaToTargets === undefined}
          onClick={() => void add()}
        >
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
            <Button
              variant="secondary"
              disabled={attachId === '' || (extraTargets.length > 0 && api.attachMediaToTargets === undefined)}
              onClick={() => void attach()}
            >
              {nls.t('features.tree.media.attach')}
            </Button>
          </>
        )}
      </div>
    </SectionCard>
  );
}

function containsTarget(targets: readonly TargetRef[], target: TargetRef): boolean {
  return targets.some((entry) => entry.targetType === target.targetType && entry.targetId === target.targetId);
}
