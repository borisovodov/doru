import { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type { PersonRecord, RepositoryRecord, TodoRecord } from '@doru/core';
import { nls } from '../nls';
import { DateEditor } from '../person/DateEditor';
import { displayName, formatDate } from '../person/format';
import { emptyTodoDraft, todoDraftToRecord, todoToDraft, type TodoDraft } from './todoDraft';
import './tasks.css';

/** The Tasks sidebar view: every todo in the tree with full editing. */
export function TasksView({
  todos,
  persons,
  repositories,
  onAddTodo,
  onUpdateTodo,
  onDeleteTodo,
  onOpenPerson,
}: {
  todos: TodoRecord[];
  persons: PersonRecord[];
  repositories: RepositoryRecord[];
  onAddTodo: (todo: TodoRecord) => Promise<void>;
  onUpdateTodo: (before: TodoRecord, after: TodoRecord) => Promise<void>;
  onDeleteTodo: (todo: TodoRecord) => Promise<void>;
  onOpenPerson: (personId: string) => void;
}) {
  const [newText, setNewText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState<TodoRecord | null>(null);
  const [edit, setEdit] = useState<TodoDraft>(emptyTodoDraft());

  const personById = new Map(persons.map((person) => [person.id, person]));
  const repositoryById = new Map(repositories.map((repository) => [repository.id, repository]));
  const isClosed = (todo: TodoRecord) => todo.status === 'closed';
  const sorted = [...todos].sort((a, b) => Number(isClosed(a)) - Number(isClosed(b)));
  const categories = [...new Set(todos.map((todo) => todo.category).filter((entry): entry is string => entry !== undefined))];
  const localities = [...new Set(todos.map((todo) => todo.locality).filter((entry): entry is string => entry !== undefined))];

  const add = async () => {
    const text = newText.trim();
    if (text === '') {
      return;
    }
    try {
      await onAddTodo({ id: crypto.randomUUID(), text });
      setNewText('');
    } catch (error) {
      console.error('adding the todo failed', error);
    }
  };

  const addOrOpen = () => {
    if (newText.trim() !== '') {
      void add();
      return;
    }
    // An empty quick-add still opens the editor for a new task so the
    // plus button always reacts visibly.
    setCreating({ id: crypto.randomUUID(), text: '' });
    setEdit(emptyTodoDraft());
    setEditingId(null);
  };

  const saveCreate = async () => {
    const todo = creating;
    if (todo === null) {
      return;
    }
    if (edit.text.trim() === '') {
      setCreating(null);
      return;
    }
    try {
      await onAddTodo(todoDraftToRecord(todo, edit));
    } catch (error) {
      console.error('adding the todo failed', error);
    }
    setCreating(null);
  };

  const toggle = async (todo: TodoRecord) => {
    const after = { ...todo };
    if (isClosed(todo)) {
      after.status = undefined;
      after.closedDate = undefined;
    } else {
      const now = new Date();
      after.status = 'closed';
      after.closedDate = { quality: 'exact', component: { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() } };
    }
    try {
      await onUpdateTodo(todo, after);
    } catch (error) {
      console.error('updating the todo failed', error);
    }
  };

  const startEdit = (todo: TodoRecord) => {
    setEditingId(todo.id);
    setCreating(null);
    setEdit(todoToDraft(todo));
  };

  const save = async (todo: TodoRecord) => {
    if (edit.text.trim() === '') {
      return;
    }
    try {
      await onUpdateTodo(todo, todoDraftToRecord(todo, edit));
    } catch (error) {
      console.error('updating the todo failed', error);
    }
    setEditingId(null);
  };

  const remove = async (todo: TodoRecord) => {
    try {
      await onDeleteTodo(todo);
    } catch (error) {
      console.error('deleting the todo failed', error);
    }
    if (editingId === todo.id) {
      setEditingId(null);
    }
  };

  const patch = (update: Partial<TodoDraft>) => setEdit((current) => ({ ...current, ...update }));

  const renderEditor = (onSave: () => Promise<void>, onDelete: (() => Promise<void>) | undefined, onCancel: () => void) => (
    <div className="task-editor">
      <input
        className="task-editor-text"
        value={edit.text}
        placeholder={nls.t('features.tasks.text')}
        onChange={(event) => patch({ text: event.target.value })}
      />
      <div className="task-editor-grid">
        <input
          list="doru-task-categories"
          placeholder={nls.t('features.tasks.category')}
          value={edit.category}
          onChange={(event) => patch({ category: event.target.value })}
        />
        <input
          list="doru-task-localities"
          placeholder={nls.t('features.tasks.locality')}
          value={edit.locality}
          onChange={(event) => patch({ locality: event.target.value })}
        />
        <select value={edit.priority} onChange={(event) => patch({ priority: event.target.value })}>
          <option value="">{nls.t('features.tasks.none')}</option>
          <option value="low">{nls.t('features.tasks.priorityLow')}</option>
          <option value="medium">{nls.t('features.tasks.priorityMedium')}</option>
          <option value="high">{nls.t('features.tasks.priorityHigh')}</option>
        </select>
        <select value={edit.status} onChange={(event) => patch({ status: event.target.value })}>
          <option value="">{nls.t('features.tasks.statusOpen')}</option>
          <option value="in-progress">{nls.t('features.tasks.statusInProgress')}</option>
          <option value="closed">{nls.t('features.tasks.statusClosed')}</option>
        </select>
        <select
          title={nls.t('features.tasks.repository')}
          value={edit.repositoryId}
          onChange={(event) => patch({ repositoryId: event.target.value })}
        >
          <option value="">{nls.t('features.tasks.none')}</option>
          {repositories.map((repository) => (
            <option key={repository.id} value={repository.id}>
              {repository.name}
            </option>
          ))}
        </select>
        <select
          title={nls.t('features.tasks.person')}
          value={edit.personId}
          onChange={(event) => patch({ personId: event.target.value })}
        >
          <option value="">{nls.t('features.tasks.none')}</option>
          {persons.map((person) => (
            <option key={person.id} value={person.id}>
              {displayName(person)}
            </option>
          ))}
        </select>
      </div>
      <DateEditor
        label={nls.t('features.tasks.scheduled')}
        value={edit.scheduled}
        onChange={(value) => patch({ scheduled: value })}
        hidePlace
      />
      <DateEditor
        label={nls.t('features.tasks.reminder')}
        value={edit.reminder}
        onChange={(value) => patch({ reminder: value })}
        hidePlace
      />
      <div className="task-editor-actions">
        <button className="primary" onClick={() => void onSave()}>
          {nls.t('features.tree.save')}
        </button>
        {onDelete !== undefined && (
          <button className="icon-button" title={nls.t('features.tasks.delete')} onClick={() => void onDelete()}>
            <Trash2 size={13} aria-hidden="true" />
          </button>
        )}
        <button className="icon-button" title={nls.t('features.tasks.cancel')} onClick={onCancel}>
          <X size={13} aria-hidden="true" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="tasks-view">
      <div className="task-add-row">
        <input
          placeholder={nls.t('features.tasks.newTask')}
          value={newText}
          onChange={(event) => setNewText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              void add();
            }
          }}
        />
        <button className="icon-button" title={nls.t('features.tasks.add')} onClick={addOrOpen}>
          <Plus size={14} aria-hidden="true" />
        </button>
      </div>
      {creating !== null && (
        <div className="task-item editing">
          {renderEditor(() => saveCreate(), undefined, () => setCreating(null))}
        </div>
      )}
      {sorted.length === 0 && creating === null ? (
        <p className="side-registries-note">{nls.t('features.tasks.empty')}</p>
      ) : (
        <ul className="task-list">
          {sorted.map((todo) => (
            <li key={todo.id} className={editingId === todo.id ? 'task-item editing' : 'task-item'}>
              {editingId === todo.id ? (
                renderEditor(() => save(todo), () => remove(todo), () => setEditingId(null))
              ) : (
                <div className="task-row" onClick={() => startEdit(todo)}>
                  <input
                    type="checkbox"
                    checked={isClosed(todo)}
                    title={nls.t('features.tasks.toggle')}
                    onClick={(event) => event.stopPropagation()}
                    onChange={() => void toggle(todo)}
                  />
                  <span className="task-row-body">
                    <span className={isClosed(todo) ? 'task-row-text closed' : 'task-row-text'}>{todo.text}</span>
                    <span className="task-row-meta">
                      {todo.priority !== undefined && (
                        <span className="task-chip">
                          {todo.priority === 'low'
                            ? nls.t('features.tasks.priorityLow')
                            : todo.priority === 'medium'
                              ? nls.t('features.tasks.priorityMedium')
                              : todo.priority === 'high'
                                ? nls.t('features.tasks.priorityHigh')
                                : todo.priority}
                        </span>
                      )}
                      {todo.category !== undefined && <span className="task-chip">{todo.category}</span>}
                      {todo.scheduledDate !== undefined && <span className="task-chip">{formatDate(todo.scheduledDate)}</span>}
                      {todo.repositoryId !== undefined && repositoryById.has(todo.repositoryId) && (
                        <span className="task-chip">{repositoryById.get(todo.repositoryId)?.name}</span>
                      )}
                      {todo.targetType === 'person' && todo.targetId !== undefined && personById.has(todo.targetId) && (
                        <button
                          className="task-chip task-chip-link"
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpenPerson(todo.targetId as string);
                          }}
                        >
                          {displayName(personById.get(todo.targetId as string))}
                        </button>
                      )}
                    </span>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <datalist id="doru-task-categories">
        {categories.map((category) => (
          <option key={category} value={category} />
        ))}
      </datalist>
      <datalist id="doru-task-localities">
        {localities.map((locality) => (
          <option key={locality} value={locality} />
        ))}
      </datalist>
    </div>
  );
}
