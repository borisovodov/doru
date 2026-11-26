import type { DatabaseSync } from 'node:sqlite';
import type { TaskRecord, TaskTargetLink, TitleRecord } from '../model/types';
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
          `INSERT INTO task (id, text, priority, status, created_at, updated_at, remind_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(...taskParams(task));
      for (const link of task.targets) {
        if (link.taskId !== task.id) {
          throw new Error(`task link ${link.id} belongs to ${link.taskId}, not ${task.id}`);
        }
        this.insertTaskLink(link);
      }
    });
  }

  updateTask(task: TaskRecord): void {
    this.transactions.run(() => {
      const changed = this.db
        .prepare(
          `UPDATE task SET text = ?, priority = ?, status = ?, created_at = ?, updated_at = ?,
             remind_at = ? WHERE id = ?`,
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
      .prepare(
        `${taskSelect}
         JOIN task_link ON task_link.task_id = task.id
         WHERE task_link.target_type = ? AND task_link.target_id = ?
         ORDER BY task.id`,
      )
      .all(targetType, targetId) as unknown as TaskRow[];
    return this.hydrateTasks(rows);
  }

  listTaskLinksFor(targetType: string, targetId: string): TaskTargetLink[] {
    const rows = this.db
      .prepare(
        `SELECT id, task_id, target_type, target_id FROM task_link
         WHERE target_type = ? AND target_id = ? ORDER BY id`,
      )
      .all(targetType, targetId) as unknown as TaskLinkRow[];
    return rows.map(rowToTaskLink);
  }

  insertTaskLink(link: TaskTargetLink): void {
    this.db
      .prepare('INSERT INTO task_link (id, task_id, target_type, target_id) VALUES (?, ?, ?, ?)')
      .run(link.id, link.taskId, link.targetType, link.targetId);
  }

  deleteTaskLink(id: string): boolean {
    return this.db.prepare('DELETE FROM task_link WHERE id = ?').run(id).changes > 0;
  }

  getTaskLink(id: string): TaskTargetLink | undefined {
    const row = this.db.prepare('SELECT id, task_id, target_type, target_id FROM task_link WHERE id = ?').get(id) as
      | TaskLinkRow
      | undefined;
    return row === undefined ? undefined : rowToTaskLink(row);
  }

  deleteTaskLinksFor(targetType: string, targetId: string): void {
    this.db.prepare('DELETE FROM task_link WHERE target_type = ? AND target_id = ?').run(targetType, targetId);
  }

  private hydrateTasks(rows: TaskRow[]): TaskRecord[] {
    const links = this.taskLinksFor(rows.map((row) => row.id));
    return rows.map((row) => ({
      id: row.id,
      text: row.text,
      targets: links.get(row.id) ?? [],
      priority: row.priority ?? undefined,
      status: row.status ?? undefined,
      createdAt: row.created_at ?? undefined,
      updatedAt: row.updated_at ?? undefined,
      remindAt: row.remind_at ?? undefined,
    }));
  }

  private taskLinksFor(taskIds: string[]): Map<string, TaskTargetLink[]> {
    const byTask = new Map<string, TaskTargetLink[]>();
    if (taskIds.length === 0) {
      return byTask;
    }
    const placeholders = taskIds.map(() => '?').join(', ');
    const rows = this.db
      .prepare(
        `SELECT id, task_id, target_type, target_id FROM task_link
         WHERE task_id IN (${placeholders}) ORDER BY id`,
      )
      .all(...taskIds) as unknown as TaskLinkRow[];
    for (const row of rows) {
      const links = byTask.get(row.task_id) ?? [];
      links.push(rowToTaskLink(row));
      byTask.set(row.task_id, links);
    }
    return byTask;
  }

  // titles ---------------------------------------------------------------------------

  insertTitle(title: TitleRecord): void {
    this.db
      .prepare(
        `INSERT INTO title (id, xref, name, author, publisher, series, abbreviation, repository_id, call_number, sequence,
           created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
           repository_id = ?, call_number = ?, sequence = ?, created_at = ?, updated_at = ? WHERE id = ?`,
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
        'SELECT id, xref, name, author, publisher, series, abbreviation, repository_id, call_number, sequence, created_at, updated_at FROM title WHERE id = ?',
      )
      .get(id) as TitleRow | undefined;
    return row === undefined ? undefined : rowToTitle(row);
  }

  listTitles(): TitleRecord[] {
    const rows = this.db
      .prepare(
        'SELECT id, xref, name, author, publisher, series, abbreviation, repository_id, call_number, sequence, created_at, updated_at FROM title ORDER BY id',
      )
      .all() as unknown as TitleRow[];
    return rows.map(rowToTitle);
  }
}

interface TaskRow {
  id: string;
  text: string;
  priority: string | null;
  status: string | null;
  created_at: number | null;
  updated_at: number | null;
  remind_at: number | null;
}

interface TaskLinkRow {
  id: string;
  task_id: string;
  target_type: string;
  target_id: string;
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
  created_at: number | null;
  updated_at: number | null;
}

const taskSelect = `SELECT task.id, task.text, task.priority, task.status,
  task.created_at, task.updated_at, task.remind_at
  FROM task`;

function taskParams(task: TaskRecord): Array<string | number | null> {
  return [
    task.id,
    task.text,
    task.priority ?? null,
    task.status ?? null,
    task.createdAt ?? null,
    task.updatedAt ?? null,
    task.remindAt ?? null,
  ];
}

function rowToTaskLink(row: TaskLinkRow): TaskTargetLink {
  return {
    id: row.id,
    taskId: row.task_id,
    targetType: row.target_type,
    targetId: row.target_id,
  };
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
    title.createdAt ?? null,
    title.updatedAt ?? null,
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
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}
