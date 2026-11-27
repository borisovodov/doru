import type { DatabaseSync } from 'node:sqlite';
import type { MediaLinkRecord, MediaRecord } from '../model/types';
import type { DateRepo } from './dateRepo';
import type { TransactionScope } from './transaction';

interface MediaRow {
  id: string;
  title: string | null;
  path: string;
  date_id: string | null;
  created_at: number | null;
  updated_at: number | null;
}

interface LinkRow {
  id: string;
  media_id: string;
  target_type: string;
  target_id: string;
  crop_top: number | null;
  crop_left: number | null;
  crop_height: number | null;
  crop_width: number | null;
  primary_flag: number;
}

/**
 * Media records with their link rows. File bytes live in the media/ folder
 * next to the project; only the path and metadata are stored here. A media
 * record is exactly one file; the flat `targetType`/`targetId` on the model
 * are projections of the first link.
 */
const MEDIA_COLUMNS = `id, title, path, date_id, created_at, updated_at`;

export class MediaRepo {
  constructor(
    private readonly db: DatabaseSync,
    private readonly dates: DateRepo,
    private readonly transactions: TransactionScope,
  ) {}

  /** Inserts the record with its links (or the flat projection as one link). */
  insertMedia(media: MediaRecord): void {
    this.transactions.run(() => {
      const dateId = media.date !== undefined ? this.dates.create(media.date) : null;
      this.db
        .prepare(
          `INSERT INTO media (id, title, path, created_at, updated_at, date_id)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(...mediaParams(media), dateId);
      this.replaceLinks(media);
    });
  }

  updateMedia(media: MediaRecord): void {
    this.transactions.run(() => {
      const current = this.db.prepare('SELECT date_id FROM media WHERE id = ?').get(media.id) as
        | { date_id: string | null }
        | undefined;
      if (current === undefined) {
        throw new Error(`media ${media.id} no longer exists`);
      }
      const prepared = this.dates.prepareSlots([current.date_id], [media.date]);
      this.db
        .prepare(
          `UPDATE media SET title = ?, path = ?, created_at = ?, updated_at = ?,
             date_id = ? WHERE id = ?`,
        )
        .run(...mediaParams(media).slice(1), prepared.ids[0] ?? null, media.id);
      this.dates.deleteMany(prepared.obsolete);
    });
  }

  deleteMedia(id: string): boolean {
    return this.transactions.run(() => {
      const targets = this.db
        .prepare('SELECT DISTINCT target_type, target_id FROM media_link WHERE media_id = ?')
        .all(id) as unknown as Array<{ target_type: string; target_id: string }>;
      const changed = this.deleteMediaRow(id);
      if (changed) {
        for (const target of targets) {
          this.ensurePrimaryLink(target.target_type, target.target_id);
        }
      }
      return changed;
    });
  }

  hasMedia(id: string): boolean {
    return this.db.prepare('SELECT 1 FROM media WHERE id = ?').get(id) !== undefined;
  }

  getMedia(id: string): MediaRecord | undefined {
    const row = this.db.prepare(`SELECT ${MEDIA_COLUMNS} FROM media WHERE id = ?`).get(id) as MediaRow | undefined;
    return row ? this.hydrate(row) : undefined;
  }

  listAllMedia(): MediaRecord[] {
    const rows = this.db.prepare(`SELECT ${MEDIA_COLUMNS} FROM media ORDER BY id`).all() as unknown as MediaRow[];
    return rows.map((row) => this.hydrate(row));
  }

  /** Records linked to the target, projected to that link. */
  listMediaFor(targetType: string, targetId: string): MediaRecord[] {
    const links = this.db
      .prepare(
        `SELECT id, media_id, target_type, target_id, crop_top, crop_left, crop_height, crop_width,
           primary_flag
         FROM media_link WHERE target_type = ? AND target_id = ? ORDER BY rowid`,
      )
      .all(targetType, targetId) as unknown as LinkRow[];
    const result: MediaRecord[] = [];
    for (const link of links) {
      const row = this.db.prepare(`SELECT ${MEDIA_COLUMNS} FROM media WHERE id = ?`).get(link.media_id) as
        | MediaRow
        | undefined;
      if (row) {
        result.push({ ...this.hydrate(row), targetType, targetId });
      }
    }
    return result;
  }

  /** The link rows targeting the given target, with their records. */
  listLinksFor(targetType: string, targetId: string): Array<{ media: MediaRecord; link: MediaLinkRecord }> {
    const links = this.db
      .prepare(
        `SELECT id, media_id, target_type, target_id, crop_top, crop_left, crop_height, crop_width,
           primary_flag
         FROM media_link WHERE target_type = ? AND target_id = ? ORDER BY rowid`,
      )
      .all(targetType, targetId) as unknown as LinkRow[];
    const result: Array<{ media: MediaRecord; link: MediaLinkRecord }> = [];
    const mediaById = new Map<string, MediaRecord>();
    for (const link of links) {
      let media = mediaById.get(link.media_id);
      if (media === undefined) {
        const row = this.db.prepare(`SELECT ${MEDIA_COLUMNS} FROM media WHERE id = ?`).get(link.media_id) as
          | MediaRow
          | undefined;
        if (row === undefined) {
          continue;
        }
        media = this.hydrate(row);
        mediaById.set(link.media_id, media);
      }
      result.push({ media, link: rowToLink(link) });
    }
    return result;
  }

  addMediaLink(mediaId: string, link: MediaLinkRecord): void {
    this.transactions.run(() => {
      if (link.primary === true) {
        this.db
          .prepare('UPDATE media_link SET primary_flag = 0 WHERE target_type = ? AND target_id = ?')
          .run(link.targetType, link.targetId);
      }
      this.db
        .prepare(
          `INSERT INTO media_link (id, media_id, target_type, target_id, crop_top, crop_left, crop_height,
             crop_width, primary_flag)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(...linkParams(mediaId, link));
      this.ensurePrimaryLink(link.targetType, link.targetId);
    });
  }

  /** Writes one link row without applying the primary invariant. */
  updateMediaLinkRow(link: MediaLinkRecord): void {
    this.db
      .prepare(
        `UPDATE media_link SET target_type = ?, target_id = ?, crop_top = ?, crop_left = ?,
           crop_height = ?, crop_width = ?, primary_flag = ?
         WHERE id = ?`,
      )
      .run(
        link.targetType,
        link.targetId,
        link.crop?.top ?? null,
        link.crop?.left ?? null,
        link.crop?.height ?? null,
        link.crop?.width ?? null,
        link.primary ? 1 : 0,
        link.id,
      );
  }

  updateMediaLink(link: MediaLinkRecord): void {
    this.transactions.run(() => {
      const before = this.db.prepare('SELECT target_type, target_id FROM media_link WHERE id = ?').get(link.id) as
        | { target_type: string; target_id: string }
        | undefined;
      if (before === undefined) {
        return;
      }
      this.updateMediaLinkRow(link);
      if (link.primary === true) {
        this.db
          .prepare('UPDATE media_link SET primary_flag = 0 WHERE target_type = ? AND target_id = ? AND id != ?')
          .run(link.targetType, link.targetId, link.id);
      }
      this.ensurePrimaryLink(link.targetType, link.targetId);
      if (before.target_type !== link.targetType || before.target_id !== link.targetId) {
        this.ensurePrimaryLink(before.target_type, before.target_id);
      }
    });
  }

  removeMediaLink(id: string): boolean {
    return this.transactions.run(() => {
      const link = this.db.prepare('SELECT target_type, target_id FROM media_link WHERE id = ?').get(id) as
        | { target_type: string; target_id: string }
        | undefined;
      const result = this.db.prepare('DELETE FROM media_link WHERE id = ?').run(id);
      if (result.changes > 0 && link) {
        this.ensurePrimaryLink(link.target_type, link.target_id);
      }
      return result.changes > 0;
    });
  }

  /**
   * Enforces the per-target invariant: whenever a target has media links,
   * exactly one of them is primary. Explicit flags win; otherwise the first
   * link in insertion order becomes the primary one.
   */
  private ensurePrimaryLink(targetType: string, targetId: string): void {
    const links = this.db
      .prepare(
        `SELECT id, primary_flag FROM media_link
         WHERE target_type = ? AND target_id = ? ORDER BY rowid`,
      )
      .all(targetType, targetId) as unknown as Array<{ id: string; primary_flag: number }>;
    if (links.length === 0) {
      return;
    }
    const primary = links.find((link) => link.primary_flag === 1);
    for (const link of links) {
      if (link.id !== primary?.id && link.primary_flag === 1) {
        this.db.prepare('UPDATE media_link SET primary_flag = 0 WHERE id = ?').run(link.id);
      }
    }
    const first = links[0];
    if (primary === undefined && first !== undefined) {
      this.db.prepare('UPDATE media_link SET primary_flag = 1 WHERE id = ?').run(first.id);
    }
  }

  /** Removes every link to the target; the shared media records survive. */
  deleteLinksFor(targetType: string, targetId: string): void {
    this.transactions.run(() => {
      this.db.prepare('DELETE FROM media_link WHERE target_type = ? AND target_id = ?').run(targetType, targetId);
    });
  }

  /** Deletes one media row and the date it owned. */
  private deleteMediaRow(id: string): boolean {
    const current = this.db.prepare('SELECT date_id FROM media WHERE id = ?').get(id) as
      | { date_id: string | null }
      | undefined;
    const changed = this.db.prepare('DELETE FROM media WHERE id = ?').run(id).changes > 0;
    if (changed) {
      this.dates.deleteMany([current?.date_id]);
    }
    return changed;
  }

  private replaceLinks(media: MediaRecord): void {
    if (media.links !== undefined) {
      for (const link of media.links) {
        this.addMediaLink(media.id, link);
      }
    } else if (media.targetType !== undefined && media.targetId !== undefined) {
      this.addMediaLink(media.id, {
        id: crypto.randomUUID(),
        mediaId: media.id,
        targetType: media.targetType,
        targetId: media.targetId,
      });
    }
  }

  hasLink(id: string): boolean {
    return this.db.prepare('SELECT 1 FROM media_link WHERE id = ?').get(id) !== undefined;
  }

  private hydrate(row: MediaRow): MediaRecord {
    const links = this.db
      .prepare(
        `SELECT id, media_id, target_type, target_id, crop_top, crop_left, crop_height, crop_width,
           primary_flag
         FROM media_link WHERE media_id = ? ORDER BY rowid`,
      )
      .all(row.id) as unknown as LinkRow[];
    const firstLink = links[0];
    const date = row.date_id !== null ? this.dates.get(row.date_id) : undefined;
    return {
      id: row.id,
      title: row.title ?? undefined,
      path: row.path,
      ...(date !== undefined ? { date } : {}),
      createdAt: row.created_at ?? undefined,
      updatedAt: row.updated_at ?? undefined,
      targetType: firstLink?.target_type,
      targetId: firstLink?.target_id,
      links: links.map(rowToLink),
    };
  }
}

function mediaParams(media: MediaRecord): Array<string | number | null> {
  return [media.id, media.title ?? null, media.path, media.createdAt ?? null, media.updatedAt ?? null];
}

function linkParams(mediaId: string, link: MediaLinkRecord): Array<string | number | null> {
  return [
    link.id,
    mediaId,
    link.targetType,
    link.targetId,
    link.crop?.top ?? null,
    link.crop?.left ?? null,
    link.crop?.height ?? null,
    link.crop?.width ?? null,
    link.primary ? 1 : 0,
  ];
}

function rowToLink(row: LinkRow): MediaLinkRecord {
  const hasCrop =
    row.crop_top !== null || row.crop_left !== null || row.crop_height !== null || row.crop_width !== null;
  const crop = hasCrop
    ? {
        ...(row.crop_top !== null ? { top: row.crop_top } : {}),
        ...(row.crop_left !== null ? { left: row.crop_left } : {}),
        ...(row.crop_height !== null ? { height: row.crop_height } : {}),
        ...(row.crop_width !== null ? { width: row.crop_width } : {}),
      }
    : undefined;
  return {
    id: row.id,
    mediaId: row.media_id,
    targetType: row.target_type,
    targetId: row.target_id,
    crop,
    primary: row.primary_flag === 1 ? true : undefined,
  };
}
