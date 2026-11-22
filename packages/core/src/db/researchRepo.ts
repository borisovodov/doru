import type { DatabaseSync } from 'node:sqlite';
import type { TitleRecord, TaskRecord } from '../model/types';
import type { DateRepo } from './dateRepo';
import type { TransactionScope } from './transaction';

/** The research layer: tasks and titles. */
export class ResearchRepo {
  constructor(
    private readonly db: DatabaseSync,
    private readonly dates: DateRepo,
    private readonly transactions: TransactionScope,
  ) {}

  // tasks -----------------------------------------------------------------------

  insertTask(task: TaskRecord): void {
    this.transactions.run(() => {
      const createdDateId = task.createdDate !== undefined ? this.dates.create(task.createdDate) : null;
      const scheduledDateId = task.scheduledDate !== undefined ? this.dates.create(task.scheduledDate) : null;
      const reminderDateId = task.reminderDate !== undefined ? this.dates.create(task.reminderDate) : null;
      const closedDateId = task.closedDate !== undefined ? this.dates.create(task.closedDate) : null;
      this.db
        .prepare(
          `INSERT INTO task (id, text, target_type, target_id, priority, status,
             created_date_id, scheduled_date_id, reminder_date_id, closed_date_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(...taskParams(task), createdDateId, scheduledDateId, reminderDateId, closedDateId);
    });
  }

  updateTask(task: TaskRecord): void {
    this.transactions.run(() => {
      const current = this.db
        .prepare(
          `SELECT created_date_id, scheduled_date_id, reminder_date_id, closed_date_id
           FROM task WHERE id = ?`,
        )
        .get(task.id) as TaskDateIds | undefined;
      if (current === undefined) {
        throw new Error(`task ${task.id} no longer exists`);
      }
      const prepared = this.dates.prepareSlots(
        [current.created_date_id, current.scheduled_date_id, current.reminder_date_id, current.closed_date_id],
        [task.createdDate, task.scheduledDate, task.reminderDate, task.closedDate],
      );
      this.db
        .prepare(
          `UPDATE task SET text = ?, target_type = ?, target_id = ?, priority = ?, status = ?,
             created_date_id = ?, scheduled_date_id = ?, reminder_date_id = ?, closed_date_id = ?
           WHERE id = ?`,
        )
        .run(...taskParams(task).slice(1), ...prepared.ids, task.id);
      this.dates.deleteMany(prepared.obsolete);
    });
  }

  deleteTask(id: string): boolean {
    return this.transactions.run(() => {
      const current = this.db
        .prepare(
          `SELECT created_date_id, scheduled_date_id, reminder_date_id, closed_date_id
           FROM task WHERE id = ?`,
        )
        .get(id) as TaskDateIds | undefined;
      const changed = this.db.prepare('DELETE FROM task WHERE id = ?').run(id).changes > 0;
      if (changed) {
        this.dates.deleteMany(taskDateIds(current));
      }
      return changed;
    });
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
    this.transactions.run(() => {
      const rows = this.db
        .prepare(
          `SELECT created_date_id, scheduled_date_id, reminder_date_id, closed_date_id
           FROM task WHERE target_type = ? AND target_id = ?`,
        )
        .all(targetType, targetId) as unknown as TaskDateIds[];
      const changed = this.db
        .prepare('DELETE FROM task WHERE target_type = ? AND target_id = ?')
        .run(targetType, targetId).changes;
      if (changed > 0) {
        this.dates.deleteMany(rows.flatMap(taskDateIds));
      }
    });
  }

  private hydrateTasks(rows: TaskRow[]): TaskRecord[] {
    const dates = this.dates.getMany(
      rows.flatMap((row) => [row.created_date_id, row.scheduled_date_id, row.reminder_date_id, row.closed_date_id]),
    );
    return rows.map((row) => ({
      id: row.id,
      text: row.text,
      targetType: row.target_type ?? undefined,
      targetId: row.target_id ?? undefined,
      priority: row.priority ?? undefined,
      status: row.status ?? undefined,
      createdDate: row.created_date_id !== null ? dates.get(row.created_date_id) : undefined,
      scheduledDate: row.scheduled_date_id !== null ? dates.get(row.scheduled_date_id) : undefined,
      reminderDate: row.reminder_date_id !== null ? dates.get(row.reminder_date_id) : undefined,
      closedDate: row.closed_date_id !== null ? dates.get(row.closed_date_id) : undefined,
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
  created_date_id: string | null;
  scheduled_date_id: string | null;
  reminder_date_id: string | null;
  closed_date_id: string | null;
}

type TaskDateIds = Pick<TaskRow, 'created_date_id' | 'scheduled_date_id' | 'reminder_date_id' | 'closed_date_id'>;

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
  created_date_id, scheduled_date_id, reminder_date_id, closed_date_id
  FROM task`;

function taskParams(task: TaskRecord): Array<string | number | null> {
  return [
    task.id,
    task.text,
    task.targetType ?? null,
    task.targetId ?? null,
    task.priority ?? null,
    task.status ?? null,
  ];
}

function taskDateIds(ids: TaskDateIds | undefined): Array<string | null> {
  if (ids === undefined) {
    return [];
  }
  return [ids.created_date_id, ids.scheduled_date_id, ids.reminder_date_id, ids.closed_date_id];
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
