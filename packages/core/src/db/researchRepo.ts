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
           created_date_id, scheduled_date_id, reminder_date_id, closed_date_id, repository_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(...todoParams(todo, this.dates));
  }

  updateTodo(todo: TodoRecord): void {
    this.db
      .prepare(
        `UPDATE todo SET text = ?, target_type = ?, target_id = ?, category = ?, locality = ?, priority = ?,
           status = ?, created_date_id = ?, scheduled_date_id = ?, reminder_date_id = ?, closed_date_id = ?, repository_id = ?
         WHERE id = ?`,
      )
      .run(...todoParams(todo, this.dates).slice(1), todo.id);
  }

  deleteTodo(id: string): boolean {
    const row = this.db
      .prepare('SELECT created_date_id, scheduled_date_id, reminder_date_id, closed_date_id FROM todo WHERE id = ?')
      .get(id) as
      | {
          created_date_id: string | null;
          scheduled_date_id: string | null;
          reminder_date_id: string | null;
          closed_date_id: string | null;
        }
      | undefined;
    const result = this.db.prepare('DELETE FROM todo WHERE id = ?').run(id);
    if (row) {
      for (const dateId of [row.created_date_id, row.scheduled_date_id, row.reminder_date_id, row.closed_date_id]) {
        if (dateId !== null) {
          this.dates.delete(dateId);
        }
      }
    }
    return result.changes > 0;
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
    const rows = this.db
      .prepare(
        `SELECT id, created_date_id, scheduled_date_id, reminder_date_id, closed_date_id
         FROM todo WHERE target_type = ? AND target_id = ?`,
      )
      .all(targetType, targetId) as unknown as {
      id: string;
      created_date_id: string | null;
      scheduled_date_id: string | null;
      reminder_date_id: string | null;
      closed_date_id: string | null;
    }[];
    this.db.prepare('DELETE FROM todo WHERE target_type = ? AND target_id = ?').run(targetType, targetId);
    for (const row of rows) {
      for (const dateId of [row.created_date_id, row.scheduled_date_id, row.reminder_date_id, row.closed_date_id]) {
        if (dateId !== null) {
          this.dates.delete(dateId);
        }
      }
    }
  }

  private hydrateTodo(row: TodoRow): TodoRecord {
    const datesById = this.dates.getMany(
      [row.created_date_id, row.scheduled_date_id, row.reminder_date_id, row.closed_date_id].filter(
        (id): id is string => id !== null,
      ),
    );
    return {
      id: row.id,
      text: row.text,
      targetType: row.target_type ?? undefined,
      targetId: row.target_id ?? undefined,
      category: row.category ?? undefined,
      locality: row.locality ?? undefined,
      priority: row.priority ?? undefined,
      status: row.status ?? undefined,
      createdDate: row.created_date_id !== null ? datesById.get(row.created_date_id) : undefined,
      scheduledDate: row.scheduled_date_id !== null ? datesById.get(row.scheduled_date_id) : undefined,
      reminderDate: row.reminder_date_id !== null ? datesById.get(row.reminder_date_id) : undefined,
      closedDate: row.closed_date_id !== null ? datesById.get(row.closed_date_id) : undefined,
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
    this.db
      .prepare(
        `UPDATE title SET xref = ?, name = ?, author = ?, publisher = ?, series = ?, abbreviation = ?,
           repository_id = ?, call_number = ?, sequence = ? WHERE id = ?`,
      )
      .run(...titleParams(title).slice(1), title.id);
  }

  deleteTitle(id: string): boolean {
    return this.db.prepare('DELETE FROM title WHERE id = ?').run(id).changes > 0;
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
  created_date_id: string | null;
  scheduled_date_id: string | null;
  reminder_date_id: string | null;
  closed_date_id: string | null;
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
  created_date_id, scheduled_date_id, reminder_date_id, closed_date_id, repository_id
  FROM todo`;

function todoParams(todo: TodoRecord, dates: DateRepo): Array<string | number | null> {
  return [
    todo.id,
    todo.text,
    todo.targetType ?? null,
    todo.targetId ?? null,
    todo.category ?? null,
    todo.locality ?? null,
    todo.priority ?? null,
    todo.status ?? null,
    todo.createdDate ? dates.upsert(todo.createdDate) : null,
    todo.scheduledDate ? dates.upsert(todo.scheduledDate) : null,
    todo.reminderDate ? dates.upsert(todo.reminderDate) : null,
    todo.closedDate ? dates.upsert(todo.closedDate) : null,
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
