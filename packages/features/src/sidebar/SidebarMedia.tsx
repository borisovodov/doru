import { useMemo } from 'react';
import { FileImage } from 'lucide-react';
import type { MediaRecord, PersonRecord } from '@doru/core';
import { displayName } from '../person/format';
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
  onOpenPerson,
}: {
  media: SidebarMediaItem[];
  persons: PersonRecord[];
  onOpenPerson: (personId: string) => void;
}) {
  const personById = useMemo(() => new Map(persons.map((person) => [person.id, person])), [persons]);

  return (
    <ul className="side-section-list">
      {media.map((item) => {
        const owner =
          item.targetType === 'person' && item.targetId !== undefined
            ? displayName(personById.get(item.targetId))
            : undefined;
        return (
          <li
            key={item.id}
            className={
              item.targetType === 'person' && item.targetId !== undefined ? 'entity-card clickable' : 'entity-card'
            }
            onClick={
              item.targetType === 'person' && item.targetId !== undefined
                ? () => onOpenPerson(item.targetId ?? '')
                : undefined
            }
          >
            {isImage(item.path ?? '') ? (
              <img
                className="entity-thumb"
                src={`doru-media://local/?path=${encodeURIComponent(item.absolutePath)}`}
                alt={item.title ?? ''}
                loading="lazy"
              />
            ) : (
              <span className="entity-card-icon">
                <FileImage size={15} aria-hidden="true" />
              </span>
            )}
            <span className="entity-card-body">
              <span className="entity-card-title">{item.title ?? fileName(item.path ?? '')}</span>
              {owner !== undefined && <span className="entity-card-subtitle">{owner}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
