import { useMemo } from 'react';
import { FileImage } from 'lucide-react';
import type { MediaRecord, PersonRecord } from '@doru/core';
import { displayName } from '@doru/ui/domain';
import { EntityCard } from '@doru/ui';
import './sidebar.css';

export interface SidebarMediaItem extends MediaRecord {
  absolutePath: string;
}

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'tiff']);

function isImage(path: string): boolean {
  const dot = path.lastIndexOf('.');
  if (dot === -1) {
    return false;
  }
  return IMAGE_EXTENSIONS.has(path.slice(dot + 1).toLowerCase());
}

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
        const image = isImage(item.path ?? '');
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
              title={item.title ?? fileName(item.path ?? '')}
              subtitle={owner ?? null}
              onClick={() => onOpenMedia(item.id)}
            />
          </li>
        );
      })}
    </ul>
  );
}
