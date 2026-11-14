import { Plus } from 'lucide-react';
import type {
  FamilyRecord,
  PersonRecord,
  PlaceRecord,
  RepositoryRecord,
  SourceRecord,
  TitleRecord,
  TodoRecord,
} from '@doru/core';
import { placeName } from '@doru/core/model';
import { displayName, familyLabel, formatDate } from '../format/format';
import { Chip } from '../../atoms/display/Chip';
import { IconButton } from '../../atoms/icon-button/IconButton';
import { nls } from '../../nls';
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
  onOpenTask,
  onNewTask,
  onOpenPerson,
  onOpenFamily,
  onOpenSource,
  onOpenPlace,
  onOpenRepository,
  onOpenTitle,
}: {
  todos: TodoRecord[];
  persons: PersonRecord[];
  families: FamilyRecord[];
  sources: SourceRecord[];
  places: PlaceRecord[];
  repositories: RepositoryRecord[];
  titles: TitleRecord[];
  onOpenTask: (todoId: string) => void;
  onNewTask: () => void;
  onOpenPerson: (personId: string) => void;
  onOpenFamily: (familyId: string) => void;
  onOpenSource: (sourceId: string) => void;
  onOpenPlace: (placeId: string) => void;
  onOpenRepository: (repositoryId: string) => void;
  onOpenTitle: (titleId: string) => void;
}) {
  const personById = new Map(persons.map((person) => [person.id, person]));
  const repositoryById = new Map(repositories.map((repository) => [repository.id, repository]));
  const isClosed = (todo: TodoRecord) => todo.status === 'closed';
  const sorted = [...todos].sort((a, b) => Number(isClosed(a)) - Number(isClosed(b)));

  const target = (todo: TodoRecord): { label: string; open: (() => void) | undefined } | undefined => {
    if (todo.targetType === undefined || todo.targetId === undefined) {
      return undefined;
    }
    switch (todo.targetType) {
      case 'person':
        return {
          label: personById.has(todo.targetId) ? displayName(personById.get(todo.targetId)) : todo.targetId,
          open: () => onOpenPerson(todo.targetId as string),
        };
      case 'family': {
        const family = families.find((entry) => entry.id === todo.targetId);
        return {
          label: family !== undefined ? familyLabel(family, personById) : todo.targetId,
          open: () => onOpenFamily(todo.targetId as string),
        };
      }
      case 'source':
        return {
          label: sources.find((entry) => entry.id === todo.targetId)?.title ?? todo.targetId,
          open: () => onOpenSource(todo.targetId as string),
        };
      case 'place': {
        const place = places.find((entry) => entry.id === todo.targetId);
        return {
          label: place !== undefined ? placeName(place) : todo.targetId,
          open: () => onOpenPlace(todo.targetId as string),
        };
      }
      case 'repository':
        return {
          label: repositoryById.get(todo.targetId)?.name ?? todo.targetId,
          open: () => onOpenRepository(todo.targetId as string),
        };
      case 'title':
        return {
          label: titles.find((entry) => entry.id === todo.targetId)?.name ?? todo.targetId,
          open: () => onOpenTitle(todo.targetId as string),
        };
      default:
        return { label: `${todo.targetType}:${todo.targetId}`, open: undefined };
    }
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
