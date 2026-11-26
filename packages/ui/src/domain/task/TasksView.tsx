import type {
  AddressRecord,
  AssociationRecord,
  CitationRecord,
  FactRecord,
  FamilyRecord,
  MediaRecord,
  PersonRecord,
  PlaceRecord,
  RepositoryRecord,
  SourceRecord,
  SubmitterRecord,
  TitleRecord,
  TaskRecord,
} from '@doru/core';
import { normalizeTaskPriority, normalizeTaskStatus } from '@doru/core/model';
import { formatTimestamp } from '../format/format';
import { Chip } from '../../atoms/display/Chip';
import { cx } from '../../lib/cx';
import { SideBarEmpty } from '../../patterns/side-bar-empty/SideBarEmpty';
import { SideBarList } from '../../patterns/side-bar-list/SideBarList';
import { nls } from '../../nls';
import { createTaskTargetLabeler, type TaskTargetData } from './taskTargets';
import styles from './TasksView.module.css';

/**
 * The Tasks sidebar view: the read-only task list. A click opens the task
 * tab; the plus button opens the new-task tab.
 */
export function TasksView({
  tasks,
  persons,
  families,
  sources,
  places,
  repositories,
  titles,
  facts,
  citations,
  media,
  submitters,
  addresses,
  associations,
  onOpenTask,
  onOpenPerson,
  onOpenFamily,
  onOpenSource,
  onOpenPlace,
  onOpenRepository,
  onOpenSubmitter,
  onOpenAddress,
  onOpenMedia,
  onOpenTitle,
  selectedId,
}: {
  tasks: TaskRecord[];
  persons: PersonRecord[];
  families: FamilyRecord[];
  sources: SourceRecord[];
  places: PlaceRecord[];
  repositories: RepositoryRecord[];
  titles: TitleRecord[];
  facts: FactRecord[];
  citations: CitationRecord[];
  media: MediaRecord[];
  submitters: SubmitterRecord[];
  addresses: AddressRecord[];
  associations: AssociationRecord[];
  onOpenTask: (taskId: string) => void;
  onOpenPerson: (personId: string) => void;
  onOpenFamily: (familyId: string) => void;
  onOpenSource: (sourceId: string) => void;
  onOpenPlace: (placeId: string) => void;
  onOpenRepository: (repositoryId: string) => void;
  onOpenSubmitter: (submitterId: string) => void;
  onOpenAddress: (addressId: string) => void;
  onOpenMedia: (mediaId: string) => void;
  onOpenTitle: (titleId: string) => void;
  /** The task whose tab is active, highlighted as the current row. */
  selectedId?: string | undefined;
}) {
  const targetData: TaskTargetData = {
    persons,
    families,
    sources,
    places,
    repositories,
    titles,
    facts,
    citations,
    media,
    submitters,
    addresses,
    associations,
    tasks,
  };
  const targetLabel = createTaskTargetLabeler(targetData);
  const isClosed = (task: TaskRecord) => normalizeTaskStatus(task.status) === 'closed';
  const sorted = [...tasks].sort((a, b) => Number(isClosed(a)) - Number(isClosed(b)));

  const target = (targetType: string, id: string): { label: string; open: (() => void) | undefined } => {
    let open: (() => void) | undefined;
    switch (targetType) {
      case 'person':
        open = () => onOpenPerson(id);
        break;
      case 'family':
        open = () => onOpenFamily(id);
        break;
      case 'family_partner':
      case 'family_child': {
        const family = families.find((entry) =>
          [...(entry.partnerLinks ?? []), ...(entry.childLinks ?? [])].some((link) => link.id === id),
        );
        open = family !== undefined ? () => onOpenFamily(family.id) : undefined;
        break;
      }
      case 'fact': {
        const fact = facts.find((entry) => entry.id === id);
        if (fact?.personId !== undefined) {
          open = () => onOpenPerson(fact.personId as string);
        } else if (fact?.familyId !== undefined) {
          open = () => onOpenFamily(fact.familyId as string);
        }
        break;
      }
      case 'name': {
        const person = persons.find((entry) => hasName(entry, id));
        open = person !== undefined ? () => onOpenPerson(person.id) : undefined;
        break;
      }
      case 'source':
        open = () => onOpenSource(id);
        break;
      case 'citation': {
        const citation = citations.find((entry) => entry.id === id);
        open = citation !== undefined ? () => onOpenSource(citation.sourceId) : undefined;
        break;
      }
      case 'media':
        open = () => onOpenMedia(id);
        break;
      case 'place':
        open = () => onOpenPlace(id);
        break;
      case 'repository':
        open = () => onOpenRepository(id);
        break;
      case 'submitter':
        open = () => onOpenSubmitter(id);
        break;
      case 'address':
        open = () => onOpenAddress(id);
        break;
      case 'association': {
        const association = associations.find((entry) => entry.id === id);
        const personId = association?.personId;
        open = personId !== undefined ? () => onOpenPerson(personId) : undefined;
        break;
      }
      case 'task':
        open = () => onOpenTask(id);
        break;
      case 'title':
        open = () => onOpenTitle(id);
        break;
      default:
        open = undefined;
    }
    return { label: targetLabel(targetType, id), open };
  };

  return (
    <div className={styles['tasksView']}>
      {sorted.length === 0 ? (
        <SideBarEmpty>{nls.t('features.tasks.empty')}</SideBarEmpty>
      ) : (
        <SideBarList>
          {sorted.map((task) => {
            const related = task.targets.map((link) => ({
              key: `${link.targetType}:${link.targetId}`,
              ...target(link.targetType, link.targetId),
            }));
            return (
              <li key={task.id} className={cx(styles['taskItem'], task.id === selectedId && styles['selected'])}>
                <div className={styles['taskRow']}>
                  <button
                    type="button"
                    className={styles['taskOpen']}
                    aria-current={task.id === selectedId ? 'true' : undefined}
                    onClick={() => onOpenTask(task.id)}
                  >
                    <span className={cx(styles['taskRowText'], isClosed(task) && styles['closed'])}>{task.text}</span>
                    <span className={styles['taskRowMeta']}>
                      <Chip variant="neutral">{priorityLabel(task.priority)}</Chip>
                      {task.remindAt !== undefined && <Chip variant="neutral">{formatTimestamp(task.remindAt)}</Chip>}
                    </span>
                  </button>
                  {related.map((entry) =>
                    entry.open === undefined ? (
                      <Chip key={entry.key} variant="neutral">
                        {entry.label}
                      </Chip>
                    ) : (
                      <button
                        key={entry.key}
                        type="button"
                        className={cx(styles['taskChip'], styles['taskChipLink'])}
                        onClick={entry.open}
                      >
                        {entry.label}
                      </button>
                    ),
                  )}
                </div>
              </li>
            );
          })}
        </SideBarList>
      )}
    </div>
  );
}

function priorityLabel(priority: string | undefined): string {
  const canonical = normalizeTaskPriority(priority);
  if (canonical === 'low') {
    return nls.t('features.tasks.priorityLow');
  }
  if (canonical === 'high') {
    return nls.t('features.tasks.priorityHigh');
  }
  return nls.t('features.tasks.priorityMedium');
}

function hasName(person: PersonRecord, nameId: string): boolean {
  const visit = (name: PersonRecord['names'][number]): boolean =>
    name.id === nameId || (name.variants ?? []).some((variant) => visit(variant));
  return person.names.some((name) => visit(name));
}
