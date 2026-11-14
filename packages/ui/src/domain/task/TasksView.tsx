import { Plus } from 'lucide-react';
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
import { IconButton } from '../../atoms/icon-button/IconButton';
import { nls } from '../../nls';
import { taskTargetLabel, type TaskTargetData } from './taskTargets';
import './TasksView.css';

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
  onNewTask,
  onOpenPerson,
  onOpenFamily,
  onOpenSource,
  onOpenPlace,
  onOpenRepository,
  onOpenSubmitter,
  onOpenAddress,
  onOpenMedia,
  onOpenTitle,
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
  onNewTask: () => void;
  onOpenPerson: (personId: string) => void;
  onOpenFamily: (familyId: string) => void;
  onOpenSource: (sourceId: string) => void;
  onOpenPlace: (placeId: string) => void;
  onOpenRepository: (repositoryId: string) => void;
  onOpenSubmitter: (submitterId: string) => void;
  onOpenAddress: (addressId: string) => void;
  onOpenMedia: (mediaId: string) => void;
  onOpenTitle: (titleId: string) => void;
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
        open = association !== undefined ? () => onOpenPerson(association.personId) : undefined;
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
    return { label: taskTargetLabel(todo.targetType, id, targetData), open };
  };

  return (
    <div className="tasks-view">
      <div className="tasks-header">
        <IconButton
          label={nls.t('features.tasks.add')}
          icon={<Plus size={14} aria-hidden="true" />}
          onClick={onNewTask}
        />
      </div>
      {sorted.length === 0 ? (
        <p className="side-registries-note">{nls.t('features.tasks.empty')}</p>
      ) : (
        <ul className="task-list">
          {sorted.map((todo) => {
            const related = target(todo);
            return (
              <li key={todo.id} className="task-item">
                <div className="task-row" onClick={() => onOpenTask(todo.id)}>
                  <span className="task-row-body">
                    <span className={isClosed(todo) ? 'task-row-text closed' : 'task-row-text'}>{todo.text}</span>
                    <span className="task-row-meta">
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
                      {related !== undefined &&
                        (related.open !== undefined ? (
                          <button
                            type="button"
                            className="task-chip task-chip-link"
                            onClick={(event) => {
                              event.stopPropagation();
                              related.open?.();
                            }}
                          >
                            {related.label}
                          </button>
                        ) : (
                          <Chip variant="neutral">{related.label}</Chip>
                        ))}
                    </span>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function hasName(person: PersonRecord, nameId: string): boolean {
  const visit = (name: PersonRecord['names'][number]): boolean =>
    name.id === nameId || (name.variants ?? []).some((variant) => visit(variant));
  return person.names.some((name) => visit(name));
}
