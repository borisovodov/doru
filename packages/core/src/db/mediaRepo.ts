import type { DatabaseSync } from 'node:sqlite';
import type { MediaRecord } from '../model/types';

export class MediaRepo {
  constructor(private readonly db: DatabaseSync) {}

  insertMedia(media: MediaRecord): void {
    this.db
      .prepare('INSERT INTO media (id, path, caption, target_type, target_id) VALUES (?, ?, ?, ?, ?)')
      .run(media.id, media.path, media.caption ?? null, media.targetType ?? null, media.targetId ?? null);
  }

  deleteMedia(id: string): boolean {
    const result = this.db.prepare('DELETE FROM media WHERE id = ?').run(id);
    return result.changes > 0;
  }

  listMediaFor(targetType: string, targetId: string): MediaRecord[] {
    const rows = this.db
      .prepare('SELECT id, path, caption, target_type, target_id FROM media WHERE target_type = ? AND target_id = ? ORDER BY id')
      .all(targetType, targetId) as unknown as Array<{
      id: string;
      path: string;
      caption: string | null;
      target_type: string | null;
      target_id: string | null;
    }>;
    return rows.map((row) => ({
      id: row.id,
      path: row.path,
      caption: row.caption ?? undefined,
      targetType: row.target_type ?? undefined,
      targetId: row.target_id ?? undefined,
    }));
  }
}
