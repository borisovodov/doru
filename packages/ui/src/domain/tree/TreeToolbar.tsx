import { useMemo } from 'react';
import { ChevronLeft, ChevronRight, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import type { ChartKind, PersonRecord } from '@doru/core';
import { displayName } from '../format/format';
import { IconButton } from '../../atoms/icon-button/IconButton';
import { SegmentedControl } from '../../patterns/segmented-control/SegmentedControl';
import { nls } from '../../nls';
import styles from './TreeToolbar.module.css';

const CHART_KINDS = [
  { kind: 'ancestors', key: 'tree.canvas.view.ancestors' },
  { kind: 'descendants', key: 'tree.canvas.view.descendants' },
  { kind: 'hourglass', key: 'tree.canvas.view.hourglass' },
  { kind: 'family', key: 'tree.canvas.view.family' },
] as const satisfies ReadonlyArray<{ kind: ChartKind; key: string }>;

export interface TreeToolbarProps {
  kind: ChartKind;
  onKindChange(kind: ChartKind): void;
  canGoBack: boolean;
  canGoForward: boolean;
  onBack(): void;
  onForward(): void;
  onCollapseAll(): void;
  onExpandAll(): void;
  /** Focus history trail (person ids), newest last. */
  breadcrumbs: string[];
  focusPersonId: string | undefined;
  persons: PersonRecord[];
  onJump(index: number): void;
}

/**
 * The canvas toolbar: chart kind switch, focus history and collapse controls.
 * Search lives outside the canvas for now.
 */
export function TreeToolbar({
  kind,
  onKindChange,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  onCollapseAll,
  onExpandAll,
  breadcrumbs,
  focusPersonId,
  persons,
  onJump,
}: TreeToolbarProps) {
  const personName = useMemo(() => {
    const byId = new Map(persons.map((person) => [person.id, person]));
    return (id: string | undefined) => displayName(id === undefined ? undefined : byId.get(id));
  }, [persons]);

  return (
    <div className={styles['toolbar']}>
      <SegmentedControl
        label={nls.t('workbench.activityBar.tree')}
        value={kind}
        onChange={onKindChange}
        options={CHART_KINDS.map((entry) => ({ value: entry.kind, label: nls.t(entry.key) }))}
      />
      <div className={styles['nav']}>
        <IconButton
          size="sm"
          label={nls.t('tree.canvas.back')}
          icon={<ChevronLeft size={16} aria-hidden="true" />}
          disabled={!canGoBack}
          onClick={onBack}
        />
        <IconButton
          size="sm"
          label={nls.t('tree.canvas.forward')}
          icon={<ChevronRight size={16} aria-hidden="true" />}
          disabled={!canGoForward}
          onClick={onForward}
        />
        <IconButton
          size="sm"
          label={nls.t('tree.canvas.collapseAll')}
          icon={<ChevronsDownUp size={16} aria-hidden="true" />}
          onClick={onCollapseAll}
        />
        <IconButton
          size="sm"
          label={nls.t('tree.canvas.expandAll')}
          icon={<ChevronsUpDown size={16} aria-hidden="true" />}
          onClick={onExpandAll}
        />
      </div>
      {breadcrumbs.length > 0 && (
        <ol className={styles['breadcrumbs']} aria-label={nls.t('tree.canvas.focusTrail')}>
          {breadcrumbs.map((personId, index) => (
            <li key={personId}>
              <button
                type="button"
                className={index === breadcrumbs.length - 1 ? styles['breadcrumbCurrent'] : styles['breadcrumb']}
                onClick={() => onJump(index)}
              >
                {personName(personId)}
              </button>
            </li>
          ))}
        </ol>
      )}
      {breadcrumbs.length === 0 && focusPersonId !== undefined && (
        <span className={styles['breadcrumbsCurrent']}>{personName(focusPersonId)}</span>
      )}
    </div>
  );
}
