import type {
  AddressRecord,
  AssociationRecord,
  CitationRecord,
  FactRecord,
  FamilyRecord,
  MediaRecord,
  NoteRecord,
  PersonRecord,
  PlaceRecord,
  RepositoryRecord,
  SourceRecord,
  SubmitterRecord,
  TitleRecord,
  TodoRecord,
} from '@doru/core';
import { formatDate } from '../format/format';
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
  todos,
  persons,
  families,
  sources,
  places,
  repositories,
  titles,
  facts,
  citations,
  notes,
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
  todos: TodoRecord[];
  persons: PersonRecord[];
  families: FamilyRecord[];
  sources: SourceRecord[];
  places: PlaceRecord[];
  repositories: RepositoryRecord[];
  titles: TitleRecord[];
  facts: FactRecord[];
  citations: CitationRecord[];
  notes: NoteRecord[];
  media: MediaRecord[];
  submitters: SubmitterRecord[];
  addresses: AddressRecord[];
  associations: AssociationRecord[];
  onOpenTask: (todoId: string) => void;
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
  const repositoryById = new Map(repositories.map((repository) => [repository.id, repository]));
  const targetData: TaskTargetData = {
    persons,
    families,
    sources,
    places,
    repositories,
    titles,
    facts,
    citations,
    notes,
    media,
    submitters,
    addresses,
    associations,
    todos,
  };
  const targetLabel = createTaskTargetLabeler(targetData);
  const isClosed = (todo: TodoRecord) => todo.status === 'closed';
  const sorted = [...todos].sort((a, b) => Number(isClosed(a)) - Number(isClosed(b)));

  const target = (todo: TodoRecord): { label: string; open: (() => void) | undefined } | undefined => {
    if (todo.targetType === undefined || todo.targetId === undefined) {
      return undefined;
    }
    const id = todo.targetId;
    let open: (() => void) | undefined;
    switch (todo.targetType) {
      case 'person':
      case 'person_sex':
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
      case 'media_file': {
        const record = media.find((entry) => (entry.files ?? []).some((file) => file.id === id));
        open = record !== undefined ? () => onOpenMedia(record.id) : undefined;
        break;
      }
      case 'media_link': {
        const record = media.find((entry) => (entry.links ?? []).some((link) => link.id === id));
        open = record !== undefined ? () => onOpenMedia(record.id) : undefined;
        break;
      }
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
      case 'todo':
        open = () => onOpenTask(id);
        break;
      case 'title':
        open = () => onOpenTitle(id);
        break;
      default:
        open = undefined;
    }
    return { label: targetLabel(todo.targetType, id), open };
  };

  return (
    <div className={styles['tasksView']}>
      {sorted.length === 0 ? (
        <SideBarEmpty>{nls.t('features.tasks.empty')}</SideBarEmpty>
      ) : (
        <SideBarList>
          {sorted.map((todo) => {
            const related = target(todo);
            return (
              <li key={todo.id} className={cx(styles['taskItem'], todo.id === selectedId && styles['selected'])}>
                <div className={styles['taskRow']}>
                  <button
                    type="button"
                    className={styles['taskOpen']}
                    aria-current={todo.id === selectedId ? 'true' : undefined}
                    onClick={() => onOpenTask(todo.id)}
                  >
                    <span className={cx(styles['taskRowText'], isClosed(todo) && styles['closed'])}>{todo.text}</span>
                    <span className={styles['taskRowMeta']}>
                      {todo.priority !== undefined && (
                        <Chip variant="neutral">
                          {todo.priority === 'low'
                            ? nls.t('features.tasks.priorityLow')
                            : todo.priority === 'medium'
                              ? nls.t('features.tasks.priorityMedium')
                              : todo.priority === 'high'
                                ? nls.t('features.tasks.priorityHigh')
                                : todo.priority}
                        </Chip>
                      )}
                      {todo.category !== undefined && <Chip variant="neutral">{todo.category}</Chip>}
                      {todo.scheduledDate !== undefined && (
                        <Chip variant="neutral">{formatDate(todo.scheduledDate)}</Chip>
                      )}
                      {todo.closedDate !== undefined && <Chip variant="neutral">{formatDate(todo.closedDate)}</Chip>}
                      {todo.repositoryId !== undefined && repositoryById.has(todo.repositoryId) && (
                        <Chip variant="neutral">{repositoryById.get(todo.repositoryId)?.name}</Chip>
                      )}
                      {related !== undefined && related.open === undefined && (
                        <Chip variant="neutral">{related.label}</Chip>
                      )}
                    </span>
                  </button>
                  {related !== undefined && related.open !== undefined && (
                    <button
                      type="button"
                      className={cx(styles['taskChip'], styles['taskChipLink'])}
                      onClick={related.open}
                    >
                      {related.label}
                    </button>
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

function hasName(person: PersonRecord, nameId: string): boolean {
  const visit = (name: PersonRecord['names'][number]): boolean =>
    name.id === nameId || (name.variants ?? []).some((variant) => visit(variant));
  return person.names.some((name) => visit(name));
}
