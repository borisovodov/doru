import type { DatabaseSync } from 'node:sqlite';
import type { TitleRecord, TaskRecord } from '../model/types';
import type { TransactionScope } from './transaction';

/** The research layer: tasks and titles. */
export class ResearchRepo {
  constructor(
    private readonly db: DatabaseSync,
    private readonly transactions: TransactionScope,
  ) {}

  // tasks -----------------------------------------------------------------------

  insertTask(task: TaskRecord): void {
    this.transactions.run(() => {
      this.db
        .prepare(
          `INSERT INTO task (id, text, target_type, target_id, priority, status,
             created_at, scheduled_at, reminder_at, closed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(...taskParams(task));
    });
  }

  updateTask(task: TaskRecord): void {
    this.transactions.run(() => {
      const changed = this.db
        .prepare(
          `UPDATE task SET text = ?, target_type = ?, target_id = ?, priority = ?, status = ?,
             created_at = ?, scheduled_at = ?, reminder_at = ?, closed_at = ?
           WHERE id = ?`,
        )
        .run(...taskParams(task).slice(1), task.id).changes;
      if (changed === 0) {
        throw new Error(`task ${task.id} no longer exists`);
      }
    });
  }

  deleteTask(id: string): boolean {
    return this.db.prepare('DELETE FROM task WHERE id = ?').run(id).changes > 0;
  }

  getTask(id: string): TaskRecord | undefined {
    const row = this.db.prepare(`${taskSelect} WHERE id = ?`).get(id) as TaskRow | undefined;
    return row === undefined ? undefined : this.hydrateTasks([row])[0];
  }

  listTasks(): TaskRecord[] {
    const rows = this.db.prepare(taskSelect).all() as unknown as TaskRow[];
    return this.hydrateTasks(rows);
  }

  listTasksFor(targetType: string, targetId: string): TaskRecord[] {
    const rows = this.db
      .prepare(`${taskSelect} WHERE target_type = ? AND target_id = ? ORDER BY id`)
      .all(targetType, targetId) as unknown as TaskRow[];
    return this.hydrateTasks(rows);
  }

  deleteTasksFor(targetType: string, targetId: string): void {
    this.db.prepare('DELETE FROM task WHERE target_type = ? AND target_id = ?').run(targetType, targetId);
  }

  private hydrateTasks(rows: TaskRow[]): TaskRecord[] {
    return rows.map((row) => ({
      id: row.id,
      text: row.text,
      targetType: row.target_type ?? undefined,
      targetId: row.target_id ?? undefined,
      priority: row.priority ?? undefined,
      status: row.status ?? undefined,
      createdAt: row.created_at ?? undefined,
      scheduledAt: row.scheduled_at ?? undefined,
      reminderAt: row.reminder_at ?? undefined,
      closedAt: row.closed_at ?? undefined,
    }));
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

interface TaskRow {
  id: string;
  text: string;
  target_type: string | null;
  target_id: string | null;
  priority: string | null;
  status: string | null;
  created_at: number | null;
  scheduled_at: number | null;
  reminder_at: number | null;
  closed_at: number | null;
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

const taskSelect = `SELECT id, text, target_type, target_id, priority, status,
  created_at, scheduled_at, reminder_at, closed_at
  FROM task`;

function taskParams(task: TaskRecord): Array<string | number | null> {
  return [
    task.id,
    task.text,
    task.targetType ?? null,
    task.targetId ?? null,
    task.priority ?? null,
    task.status ?? null,
    task.createdAt ?? null,
    task.scheduledAt ?? null,
    task.reminderAt ?? null,
    task.closedAt ?? null,
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
