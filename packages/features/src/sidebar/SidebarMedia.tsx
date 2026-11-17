import { useMemo } from 'react';
import { FileImage } from 'lucide-react';
import { isImagePath, type PersonRecord } from '@doru/core';
import type { MediaWithPath } from '@doru/ui/domain';
import { displayName } from '@doru/ui/domain';
import { EntityCard } from '@doru/ui';
import './sidebar.css';

export type SidebarMediaItem = MediaWithPath;

/** The file name part of a slash-separated project-relative path. */
function fileName(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] ?? path;
}

/**
 * The Media sidebar: every media record with a thumbnail (for images) and
 * the owner person's name. Clicking opens the owner.
 */
export function SidebarMedia({
  media,
  persons,
  onOpenMedia,
}: {
  media: SidebarMediaItem[];
  persons: PersonRecord[];
  onOpenMedia: (mediaId: string) => void;
}) {
  const personById = useMemo(() => new Map(persons.map((person) => [person.id, person])), [persons]);

  return (
    <ul className="side-section-list">
      {media.map((item) => {
        const owner =
          item.targetType === 'person' && item.targetId !== undefined
            ? displayName(personById.get(item.targetId))
            : undefined;
        const image = item.absolutePath !== '' && isImagePath(item.path);
        return (
          <li key={item.id}>
            <EntityCard
              {...(image
                ? {
                    thumbnail: {
                      src: `doru-media://local/?path=${encodeURIComponent(item.absolutePath)}`,
                      alt: item.title ?? '',
                    },
                  }
                : { icon: <FileImage size={15} aria-hidden="true" /> })}
              title={item.title ?? (fileName(item.path ?? '') || item.id)}
              subtitle={owner ?? null}
              onClick={() => onOpenMedia(item.id)}
            />
          </li>
        );
      })}
    </ul>
  );
}
