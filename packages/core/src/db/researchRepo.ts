import type { DatabaseSync } from 'node:sqlite';
import type { TitleRecord, TodoRecord } from '../model/types';
import type { DateRepo } from './dateRepo';

/** The research layer: todos and titles. */
export class ResearchRepo {
  constructor(
    private readonly db: DatabaseSync,
    private readonly dates: DateRepo,
  ) {}

  // todos -----------------------------------------------------------------------

  insertTodo(todo: TodoRecord): void {
    this.db
      .prepare(
        `INSERT INTO todo (id, text, target_type, target_id, category, locality, priority, status,
           repository_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(...todoParams(todo));
    this.replaceTodoDates(todo);
  }

  updateTodo(todo: TodoRecord): void {
    if (this.db.prepare('SELECT 1 FROM todo WHERE id = ?').get(todo.id) === undefined) {
      throw new Error(`todo ${todo.id} no longer exists`);
    }
    this.db
      .prepare(
        `UPDATE todo SET text = ?, target_type = ?, target_id = ?, category = ?, locality = ?, priority = ?,
           status = ?, repository_id = ?
         WHERE id = ?`,
      )
      .run(...todoParams(todo).slice(1), todo.id);
    this.replaceTodoDates(todo);
  }

  setTodoRepositoryId(id: string, repositoryId: string | undefined): void {
    this.db
      .prepare('UPDATE todo SET repository_id = ? WHERE id = ? AND repository_id IS NULL')
      .run(repositoryId ?? null, id);
  }

  deleteTodo(id: string): boolean {
    return this.db.prepare('DELETE FROM todo WHERE id = ?').run(id).changes > 0;
  }

  getTodo(id: string): TodoRecord | undefined {
    const row = this.db.prepare(`${todoSelect} WHERE id = ?`).get(id) as TodoRow | undefined;
    return row === undefined ? undefined : this.hydrateTodo(row);
  }

  listTodos(): TodoRecord[] {
    const rows = this.db.prepare(todoSelect).all() as unknown as TodoRow[];
    return rows.map((row) => this.hydrateTodo(row));
  }

  listTodosFor(targetType: string, targetId: string): TodoRecord[] {
    const rows = this.db
      .prepare(`${todoSelect} WHERE target_type = ? AND target_id = ? ORDER BY id`)
      .all(targetType, targetId) as unknown as TodoRow[];
    return rows.map((row) => this.hydrateTodo(row));
  }

  deleteTodosFor(targetType: string, targetId: string): void {
    this.db.prepare('DELETE FROM todo WHERE target_type = ? AND target_id = ?').run(targetType, targetId);
  }

  private replaceTodoDates(todo: TodoRecord): void {
    this.dates.replaceForOwner('todo', todo.id, {
      created: todo.createdDate,
      scheduled: todo.scheduledDate,
      reminder: todo.reminderDate,
      closed: todo.closedDate,
    });
  }

  private hydrateTodo(row: TodoRow): TodoRecord {
    const dates = this.dates.getManyForOwners('todo', [row.id]).get(row.id);
    return {
      id: row.id,
      text: row.text,
      targetType: row.target_type ?? undefined,
      targetId: row.target_id ?? undefined,
      category: row.category ?? undefined,
      locality: row.locality ?? undefined,
      priority: row.priority ?? undefined,
      status: row.status ?? undefined,
      createdDate: dates?.get('created'),
      scheduledDate: dates?.get('scheduled'),
      reminderDate: dates?.get('reminder'),
      closedDate: dates?.get('closed'),
      repositoryId: row.repository_id ?? undefined,
    };
  }

  // titles ---------------------------------------------------------------------------

  insertTitle(title: TitleRecord): void {
    this.db
      .prepare(
        `INSERT INTO title (id, xref, name, author, publisher, series, abbreviation, repository_id, call_number, sequence)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(...titleParams(title));
  }

  updateTitle(title: TitleRecord): void {
    if (this.db.prepare('SELECT 1 FROM title WHERE id = ?').get(title.id) === undefined) {
      throw new Error(`title ${title.id} no longer exists`);
    }
    this.db
      .prepare(
        `UPDATE title SET xref = ?, name = ?, author = ?, publisher = ?, series = ?, abbreviation = ?,
           repository_id = ?, call_number = ?, sequence = ? WHERE id = ?`,
      )
      .run(...titleParams(title).slice(1), title.id);
  }

  setTitleRepositoryId(id: string, repositoryId: string | undefined): void {
    this.db
      .prepare('UPDATE title SET repository_id = ? WHERE id = ? AND repository_id IS NULL')
      .run(repositoryId ?? null, id);
  }

  deleteTitle(id: string): boolean {
    return this.db.prepare('DELETE FROM title WHERE id = ?').run(id).changes > 0;
  }

  getTitle(id: string): TitleRecord | undefined {
    const row = this.db
      .prepare(
        'SELECT id, xref, name, author, publisher, series, abbreviation, repository_id, call_number, sequence FROM title WHERE id = ?',
      )
      .get(id) as TitleRow | undefined;
    return row === undefined ? undefined : rowToTitle(row);
  }

  listTitles(): TitleRecord[] {
    const rows = this.db
      .prepare(
        'SELECT id, xref, name, author, publisher, series, abbreviation, repository_id, call_number, sequence FROM title ORDER BY id',
      )
      .all() as unknown as TitleRow[];
    return rows.map(rowToTitle);
  }
}

interface TodoRow {
  id: string;
  text: string;
  target_type: string | null;
  target_id: string | null;
  category: string | null;
  locality: string | null;
  priority: string | null;
  status: string | null;
  repository_id: string | null;
}

interface TitleRow {
  id: string;
  xref: string | null;
  name: string | null;
  author: string | null;
  publisher: string | null;
  series: string | null;
  abbreviation: string | null;
  repository_id: string | null;
  call_number: string | null;
  sequence: number | null;
}

const todoSelect = `SELECT id, text, target_type, target_id, category, locality, priority, status,
  repository_id
  FROM todo`;

function todoParams(todo: TodoRecord): Array<string | number | null> {
  return [
    todo.id,
    todo.text,
    todo.targetType ?? null,
    todo.targetId ?? null,
    todo.category ?? null,
    todo.locality ?? null,
    todo.priority ?? null,
    todo.status ?? null,
    todo.repositoryId ?? null,
  ];
}

function titleParams(title: TitleRecord): Array<string | number | null> {
  return [
    title.id,
    title.xref ?? null,
    title.name ?? null,
    title.author ?? null,
    title.publisher ?? null,
    title.series ?? null,
    title.abbreviation ?? null,
    title.repositoryId ?? null,
    title.callNumber ?? null,
    title.sequence ?? null,
  ];
}

function rowToTitle(row: TitleRow): TitleRecord {
  return {
    id: row.id,
    xref: row.xref ?? undefined,
    name: row.name ?? undefined,
    author: row.author ?? undefined,
    publisher: row.publisher ?? undefined,
    series: row.series ?? undefined,
    abbreviation: row.abbreviation ?? undefined,
    repositoryId: row.repository_id ?? undefined,
    callNumber: row.call_number ?? undefined,
    sequence: row.sequence ?? undefined,
  };
}
