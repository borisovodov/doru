import { useMemo } from 'react';
import { FileImage } from 'lucide-react';
import { isExternalMediaPath, isImagePath, type MediaRecord, type PersonRecord } from '@doru/core/model';
import { displayName } from '@doru/ui/domain';
import { EntityRow, SideBarList } from '@doru/ui';
import './sidebar.css';

export interface SidebarMediaItem extends MediaRecord {
  absolutePath: string;
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
  selectedId,
}: {
  media: SidebarMediaItem[];
  persons: PersonRecord[];
  onOpenMedia: (mediaId: string) => void;
  selectedId?: string | undefined;
}) {
  const personById = useMemo(() => new Map(persons.map((person) => [person.id, person])), [persons]);

  return (
    <SideBarList>
      {media.map((item) => {
        const owner =
          item.targetType === 'person' && item.targetId !== undefined
            ? displayName(personById.get(item.targetId))
            : undefined;
        const image = item.absolutePath !== '' && isImagePath(item.path);
        return (
          <li key={item.id}>
            <EntityRow
              selected={item.id === selectedId}
              {...(image
                ? {
                    thumbnail: {
                      src: `doru-media://local/?path=${encodeURIComponent(item.absolutePath)}`,
                      // The title is already the row button name; the image is decorative.
                      alt: '',
                    },
                  }
                : { icon: <FileImage size={15} aria-hidden="true" /> })}
              title={item.title ?? (isExternalMediaPath(item.path) ? item.id : fileName(item.path) || item.id)}
              subtitle={owner ?? null}
              onClick={() => onOpenMedia(item.id)}
            />
          </li>
        );
      })}
    </SideBarList>
  );
}
