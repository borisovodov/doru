import type { ReactNode } from 'react';
import { BookOpenText, ChevronDown, ChevronRight, Image as ImageIcon, StickyNote } from 'lucide-react';
import type { PedigreeLine, PersonRecord } from '@doru/core';
import { factOf } from '@doru/core/model';
import { cx } from '../../lib/cx';
import { Avatar } from '../../atoms/display/Avatar';
import { Badge } from '../../atoms/display/Badge';
import { IconButton } from '../../atoms/icon-button/IconButton';
import { nls } from '../../nls';
import { displayName, initials, years } from '../format/format';
import type { PersonCounts } from './types';
import styles from './PersonCardView.module.css';

export interface PersonCardViewProps {
  person: PersonRecord;
  line: PedigreeLine;
  isFocus: boolean;
  hasSubtree: boolean;
  collapsed: boolean;
  counts: PersonCounts;
  isDropTarget: boolean;
  selected?: boolean | undefined;
  dragging?: boolean | undefined;
  isDraft?: boolean | undefined;
  isEditing?: boolean | undefined;
  /** The in-card draft form shown while `isEditing` is true. */
  editingContent?: ReactNode;
  onToggleCollapse?: ((personId: string) => void) | undefined;
  /** React Flow handles, rendered inside the card root. */
  children?: ReactNode;
  /** The selected-card toolbar, rendered by the caller. */
  toolbar?: ReactNode;
}

const BADGES = [
  { icon: StickyNote, count: 'notes', title: 'features.tree.notes.title' },
  { icon: BookOpenText, count: 'sources', title: 'features.tree.sources.title' },
  { icon: ImageIcon, count: 'media', title: 'features.tree.media.title' },
] as const;

/** The visual person card used by the canvas and by the component gallery. */
export function PersonCardView({
  person,
  line,
  isFocus,
  hasSubtree,
  collapsed,
  counts,
  isDropTarget,
  selected = false,
  dragging = false,
  isDraft = false,
  isEditing = false,
  editingContent,
  onToggleCollapse,
  children,
  toolbar,
}: PersonCardViewProps) {
  const deceased = factOf(person, 'DEAT')?.date?.component?.year !== undefined;
  const dates = years(person);

  if (isEditing) {
    return (
      <div
        className={cx(styles['card'], styles['editing'])}
        role="group"
        aria-label={nls.t('tree.canvas.addFirstPerson')}
        aria-current={isFocus ? 'true' : undefined}
      >
        {children}
        {editingContent}
      </div>
    );
  }

  return (
    <div
      className={cx(
        styles['card'],
        styles[person.sex === 'M' ? 'sexM' : person.sex === 'F' ? 'sexF' : 'sexU'],
        line === 'paternal' ? styles['linePaternal'] : line === 'maternal' ? styles['lineMaternal'] : false,
        selected && styles['selected'],
        isFocus && styles['focus'],
        deceased && styles['deceased'],
        dragging && styles['dragging'],
        isDropTarget && styles['dropTarget'],
        isDraft && styles['draft'],
      )}
      role="group"
      aria-label={isDraft ? nls.t('tree.canvas.addFirstPerson') : displayName(person)}
      aria-current={isFocus ? 'true' : undefined}
    >
      {children}
      <Avatar
        initials={initials(person)}
        tone={person.sex === 'M' ? 'male' : person.sex === 'F' ? 'female' : 'neutral'}
        size="md"
        shape="circle"
      />
      <div className={styles['body']}>
        <span className={styles['name']}>{isDraft ? nls.t('tree.canvas.addFirstPerson') : displayName(person)}</span>
        {!isDraft && dates !== '' ? (
          <span className={styles['years']}>
            {deceased ? '† ' : ''}
            {dates}
          </span>
        ) : null}
      </div>
      <div className={styles['badges']}>
        {BADGES.map(({ icon: Icon, count, title }) =>
          counts[count] > 0 ? (
            <Badge key={count} icon={<Icon size={11} aria-hidden="true" />} title={nls.t(title)}>
              {counts[count]}
            </Badge>
          ) : null,
        )}
      </div>
      {hasSubtree ? (
        <IconButton
          className={styles['collapse'] ?? ''}
          size="sm"
          label={collapsed ? nls.t('tree.canvas.expand') : nls.t('tree.canvas.collapse')}
          icon={
            collapsed ? <ChevronRight size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />
          }
          onClick={(event) => {
            event.stopPropagation();
            onToggleCollapse?.(person.id);
          }}
        />
      ) : null}
      {toolbar}
    </div>
  );
}
