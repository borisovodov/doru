import type { DatabaseSync } from 'node:sqlite';
import type { MediaFile, MediaFileTranslation, MediaLinkRecord, MediaRecord } from '../model/types';
import type { DateRepo } from './dateRepo';
import type { TransactionScope } from './transaction';

interface MediaRow {
  id: string;
  xref: string | null;
  title: string | null;
  place_id: string | null;
  place_text: string | null;
  object_type: string | null;
  description: string | null;
  keywords: string | null;
}

interface FileRow {
  id: string;
  media_id: string;
  path: string;
  title: string | null;
  medium: string | null;
  content_type: string | null;
  text: string | null;
  position: number;
}

interface TranslationRow {
  id: string;
  media_file_id: string;
  path: string;
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
const MEDIA_COLUMNS = `id, xref, title, place_id, place_text, object_type, description, keywords`;

export class MediaRepo {
  constructor(
    private readonly db: DatabaseSync,
    private readonly dates: DateRepo,
    private readonly transactions: TransactionScope,
  ) {}

  /** Inserts the record with its files and links (or the flat projection as one file+link). */
  insertMedia(media: MediaRecord): void {
    this.transactions.run(() => {
      this.db
        .prepare(
          `INSERT INTO media (id, xref, title, place_id, place_text, object_type, description, keywords)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(...mediaParams(media));
      this.dates.upsertForOwner('media', media.id, 'date', media.date);
      this.replaceFiles(media);
      this.replaceLinks(media);
    });
  }

  updateMedia(media: MediaRecord): void {
    this.transactions.run(() => {
      if (this.db.prepare('SELECT 1 FROM media WHERE id = ?').get(media.id) === undefined) {
        throw new Error(`media ${media.id} no longer exists`);
      }
      this.db
        .prepare(
          `UPDATE media SET xref = ?, title = ?, place_id = ?, place_text = ?,
             object_type = ?, description = ?, keywords = ? WHERE id = ?`,
        )
        .run(...mediaParams(media).slice(1), media.id);
      this.dates.upsertForOwner('media', media.id, 'date', media.date);
      this.replaceFiles(media);
    });
  }

  /** Reconnects a surviving media record to its place after a place-delete undo. */
  setPlaceId(id: string, placeId: string | undefined): void {
    this.db.prepare('UPDATE media SET place_id = ? WHERE id = ? AND place_id IS NULL').run(placeId ?? null, id);
  }

  deleteMedia(id: string): boolean {
    return this.transactions.run(() => this.deleteMediaRow(id));
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
           title, sequence, primary_flag, scrapbook, slideshow, thumbnail, exclude, caption
         FROM media_link WHERE target_type = ? AND target_id = ? ORDER BY sequence, id`,
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
           title, sequence, primary_flag, scrapbook, slideshow, thumbnail, exclude, caption
         FROM media_link WHERE target_type = ? AND target_id = ? ORDER BY sequence, id`,
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
        this.deleteMediaRow(link.media_id);
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
        this.deleteMediaRow(link.media_id);
      }
    }
  }

  /** Deletes one media row; the owner trigger deletes its date row. */
  private deleteMediaRow(id: string): boolean {
    return this.db.prepare('DELETE FROM media WHERE id = ?').run(id).changes > 0;
  }

  private replaceFiles(media: MediaRecord): void {
    const existing = this.db
      .prepare('SELECT id, path FROM media_file WHERE media_id = ? ORDER BY position')
      .all(media.id) as unknown as { id: string; path: string }[];
    this.db
      .prepare(
        'DELETE FROM media_file_translation WHERE media_file_id IN (SELECT id FROM media_file WHERE media_id = ?)',
      )
      .run(media.id);
    this.db.prepare('DELETE FROM media_file WHERE media_id = ?').run(media.id);
    const insert = this.db.prepare(
      `INSERT INTO media_file (id, media_id, path, title, medium, content_type, text, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertTranslation = this.db.prepare(
      'INSERT INTO media_file_translation (id, media_file_id, path, position) VALUES (?, ?, ?, ?)',
    );
    const fallbackId =
      media.path !== undefined
        ? (existing.find((entry) => entry.path === media.path)?.id ?? crypto.randomUUID())
        : crypto.randomUUID();
    const files: MediaFile[] = media.files ?? (media.path !== undefined ? [{ id: fallbackId, path: media.path }] : []);
    for (const [position, file] of files.entries()) {
      insert.run(
        file.id,
        media.id,
        file.path,
        file.title ?? null,
        file.medium ?? null,
        file.contentType ?? null,
        file.text ?? null,
        position,
      );
      for (const translation of file.translations ?? []) {
        insertTranslation.run(translation.id, file.id, translation.path, translation.position);
      }
    }
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

  hasFile(id: string): boolean {
    return this.db.prepare('SELECT 1 FROM media_file WHERE id = ?').get(id) !== undefined;
  }

  private hydrate(row: MediaRow): MediaRecord {
    const files = this.db
      .prepare(
        `SELECT id, media_id, path, title, medium, content_type, text, position
         FROM media_file WHERE media_id = ? ORDER BY position`,
      )
      .all(row.id) as unknown as FileRow[];
    const links = this.db
      .prepare(
        `SELECT id, media_id, target_type, target_id, crop_top, crop_left, crop_height, crop_width,
           title, sequence, primary_flag, scrapbook, slideshow, thumbnail, exclude, caption
         FROM media_link WHERE media_id = ? ORDER BY sequence, id`,
      )
      .all(row.id) as unknown as LinkRow[];
    const translationsByFile = this.translationsForFiles(files.map((file) => file.id));
    const firstFile = files[0];
    const firstLink = links[0];
    const date = this.dates.getForOwner('media', row.id, 'date');
    return {
      id: row.id,
      xref: row.xref ?? undefined,
      title: row.title ?? undefined,
      ...(date !== undefined ? { date } : {}),
      ...(row.place_id !== null ? { placeId: row.place_id } : {}),
      ...(row.place_text !== null ? { place: row.place_text } : {}),
      ...(row.object_type !== null ? { objectType: row.object_type } : {}),
      ...(row.description !== null ? { description: row.description } : {}),
      ...(row.keywords !== null ? { keywords: row.keywords } : {}),
      path: firstFile?.path,
      targetType: firstLink?.target_type,
      targetId: firstLink?.target_id,
      files: files.map((file) => ({
        id: file.id,
        path: file.path,
        title: file.title ?? undefined,
        ...(file.medium !== null ? { medium: file.medium } : {}),
        ...(file.content_type !== null ? { contentType: file.content_type } : {}),
        ...(file.text !== null ? { text: file.text } : {}),
        translations: translationsByFile.get(file.id) ?? [],
      })),
      links: links.map(rowToLink),
    };
  }

  private translationsForFiles(fileIds: string[]): Map<string, MediaFileTranslation[]> {
    const byFile = new Map<string, MediaFileTranslation[]>();
    if (fileIds.length === 0) {
      return byFile;
    }
    const placeholders = fileIds.map(() => '?').join(', ');
    const rows = this.db
      .prepare(
        `SELECT id, media_file_id, path, position FROM media_file_translation
         WHERE media_file_id IN (${placeholders}) ORDER BY position`,
      )
      .all(...fileIds) as unknown as TranslationRow[];
    for (const row of rows) {
      const list = byFile.get(row.media_file_id) ?? [];
      list.push({ id: row.id, path: row.path, position: row.position });
      byFile.set(row.media_file_id, list);
    }
    return byFile;
  }
}

function mediaParams(media: MediaRecord): Array<string | number | null> {
  return [
    media.id,
    media.xref ?? null,
    media.title ?? null,
    media.placeId ?? null,
    media.place ?? null,
    media.objectType ?? null,
    media.description ?? null,
    media.keywords ?? null,
  ];
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
