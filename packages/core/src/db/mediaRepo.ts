import type { DatabaseSync } from 'node:sqlite';
import type { MediaFile, MediaLinkRecord, MediaRecord } from '../model/types';

interface MediaRow {
  id: string;
  xref: string | null;
  title: string | null;
}

interface FileRow {
  id: string;
  media_id: string;
  path: string;
  title: string | null;
  position: number;
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
  title: string | null;
  sequence: number | null;
  primary_flag: number;
  scrapbook: number;
  slideshow: number;
  thumbnail: number;
  exclude: number;
  caption: number;
}

/**
 * Media records with their file rows and link rows. File bytes live in the
 * media/ folder next to the project; only paths and titles are stored here.
 * The flat `path`/`targetType`/`targetId` on the model are projections of
 * the first file and the first link.
 */
export class MediaRepo {
  constructor(private readonly db: DatabaseSync) {}

  /** Inserts the record with its files and links (or the flat projection as one file+link). */
  insertMedia(media: MediaRecord): void {
    this.db
      .prepare('INSERT INTO media (id, xref, title) VALUES (?, ?, ?)')
      .run(media.id, media.xref ?? null, media.title ?? null);
    this.replaceFiles(media);
    this.replaceLinks(media);
  }

  updateMedia(media: MediaRecord): void {
    this.db
      .prepare('UPDATE media SET xref = ?, title = ? WHERE id = ?')
      .run(media.xref ?? null, media.title ?? null, media.id);
    this.replaceFiles(media);
  }

  deleteMedia(id: string): boolean {
    return this.db.prepare('DELETE FROM media WHERE id = ?').run(id).changes > 0;
  }

  getMedia(id: string): MediaRecord | undefined {
    const row = this.db.prepare('SELECT id, xref, title FROM media WHERE id = ?').get(id) as MediaRow | undefined;
    return row ? this.hydrate(row) : undefined;
  }

  listAllMedia(): MediaRecord[] {
    const rows = this.db.prepare('SELECT id, xref, title FROM media ORDER BY id').all() as unknown as MediaRow[];
    return rows.map((row) => this.hydrate(row));
  }

  /** Records linked to the target, projected to that link. */
  listMediaFor(targetType: string, targetId: string): MediaRecord[] {
    const links = this.db
      .prepare(
        `SELECT id, media_id, target_type, target_id, crop_top, crop_left, crop_height, crop_width,
           title, sequence, primary_flag, scrapbook, slideshow, thumbnail, exclude, caption
         FROM media_link WHERE target_type = ? AND target_id = ? ORDER BY sequence, id`,
      )
      .all(targetType, targetId) as unknown as LinkRow[];
    const result: MediaRecord[] = [];
    for (const link of links) {
      const row = this.db.prepare('SELECT id, xref, title FROM media WHERE id = ?').get(link.media_id) as
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
           title, sequence, primary_flag, scrapbook, slideshow, thumbnail, exclude, caption
         FROM media_link WHERE target_type = ? AND target_id = ? ORDER BY sequence, id`,
      )
      .all(targetType, targetId) as unknown as LinkRow[];
    const result: Array<{ media: MediaRecord; link: MediaLinkRecord }> = [];
    for (const link of links) {
      const row = this.db.prepare('SELECT id, xref, title FROM media WHERE id = ?').get(link.media_id) as
        | MediaRow
        | undefined;
      if (row) {
        result.push({ media: this.hydrate(row), link: rowToLink(link) });
      }
    }
    return result;
  }

  addMediaLink(mediaId: string, link: MediaLinkRecord): void {
    this.db
      .prepare(
        `INSERT INTO media_link (id, media_id, target_type, target_id, crop_top, crop_left, crop_height,
           crop_width, title, sequence, primary_flag, scrapbook, slideshow, thumbnail, exclude, caption)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(...linkParams(mediaId, link));
  }

  updateMediaLink(link: MediaLinkRecord): void {
    this.db
      .prepare(
        `UPDATE media_link SET target_type = ?, target_id = ?, crop_top = ?, crop_left = ?,
           crop_height = ?, crop_width = ?, title = ?, sequence = ?, primary_flag = ?,
           scrapbook = ?, slideshow = ?, thumbnail = ?, exclude = ?, caption = ?
         WHERE id = ?`,
      )
      .run(
        link.targetType,
        link.targetId,
        link.crop?.top ?? null,
        link.crop?.left ?? null,
        link.crop?.height ?? null,
        link.crop?.width ?? null,
        link.title ?? null,
        link.sequence ?? null,
        link.primary ? 1 : 0,
        link.scrapbook ? 1 : 0,
        link.slideshow ? 1 : 0,
        link.thumbnail ? 1 : 0,
        link.exclude ? 1 : 0,
        link.caption ? 1 : 0,
        link.id,
      );
  }

  /** The media record that owns a link, before the link is removed. */
  getMediaIdForLink(id: string): string | undefined {
    const row = this.db.prepare('SELECT media_id FROM media_link WHERE id = ?').get(id) as
      | { media_id: string }
      | undefined;
    return row?.media_id;
  }

  removeMediaLink(id: string): boolean {
    const link = this.db.prepare('SELECT media_id FROM media_link WHERE id = ?').get(id) as
      | { media_id: string }
      | undefined;
    const result = this.db.prepare('DELETE FROM media_link WHERE id = ?').run(id);
    if (result.changes > 0 && link) {
      const remaining = this.db
        .prepare('SELECT COUNT(*) AS n FROM media_link WHERE media_id = ?')
        .get(link.media_id) as {
        n: number;
      };
      if (remaining.n === 0) {
        this.db.prepare('DELETE FROM media WHERE id = ?').run(link.media_id);
      }
    }
    return result.changes > 0;
  }

  /** Removes every link to the target, deleting records left with no links. */
  deleteLinksFor(targetType: string, targetId: string): void {
    const links = this.db
      .prepare('SELECT id, media_id FROM media_link WHERE target_type = ? AND target_id = ?')
      .all(targetType, targetId) as unknown as { id: string; media_id: string }[];
    this.db.prepare('DELETE FROM media_link WHERE target_type = ? AND target_id = ?').run(targetType, targetId);
    for (const link of links) {
      const remaining = this.db
        .prepare('SELECT COUNT(*) AS n FROM media_link WHERE media_id = ?')
        .get(link.media_id) as {
        n: number;
      };
      if (remaining.n === 0) {
        this.db.prepare('DELETE FROM media WHERE id = ?').run(link.media_id);
      }
    }
  }

  private replaceFiles(media: MediaRecord): void {
    this.db.prepare('DELETE FROM media_file WHERE media_id = ?').run(media.id);
    const insert = this.db.prepare(
      'INSERT INTO media_file (id, media_id, path, title, position) VALUES (?, ?, ?, ?, ?)',
    );
    const files: MediaFile[] =
      media.files ?? (media.path !== undefined ? [{ id: crypto.randomUUID(), path: media.path }] : []);
    files.forEach((file, position) => {
      insert.run(file.id, media.id, file.path, file.title ?? null, position);
    });
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

  private hydrate(row: MediaRow): MediaRecord {
    const files = this.db
      .prepare('SELECT id, media_id, path, title, position FROM media_file WHERE media_id = ? ORDER BY position')
      .all(row.id) as unknown as FileRow[];
    const links = this.db
      .prepare(
        `SELECT id, media_id, target_type, target_id, crop_top, crop_left, crop_height, crop_width,
           title, sequence, primary_flag, scrapbook, slideshow, thumbnail, exclude, caption
         FROM media_link WHERE media_id = ? ORDER BY sequence, id`,
      )
      .all(row.id) as unknown as LinkRow[];
    const firstFile = files[0];
    const firstLink = links[0];
    return {
      id: row.id,
      xref: row.xref ?? undefined,
      title: row.title ?? undefined,
      path: firstFile?.path,
      targetType: firstLink?.target_type,
      targetId: firstLink?.target_id,
      files: files.map((file) => ({
        id: file.id,
        path: file.path,
        title: file.title ?? undefined,
      })),
      links: links.map(rowToLink),
    };
  }
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
    link.title ?? null,
    link.sequence ?? null,
    link.primary ? 1 : 0,
    link.scrapbook ? 1 : 0,
    link.slideshow ? 1 : 0,
    link.thumbnail ? 1 : 0,
    link.exclude ? 1 : 0,
    link.caption ? 1 : 0,
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
    title: row.title ?? undefined,
    sequence: row.sequence ?? undefined,
    primary: row.primary_flag === 1 ? true : undefined,
    scrapbook: row.scrapbook === 1 ? true : undefined,
    slideshow: row.slideshow === 1 ? true : undefined,
    thumbnail: row.thumbnail === 1 ? true : undefined,
    exclude: row.exclude === 1 ? true : undefined,
    caption: row.caption === 1 ? true : undefined,
  };
}
