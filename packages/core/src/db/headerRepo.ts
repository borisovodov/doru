import type { DatabaseSync } from 'node:sqlite';
import type { HeaderRecord } from '../model/types';
import type { DateRepo } from './dateRepo';

/**
 * The single-row project header (GEDCOM HEAD/SUBN metadata). Reading returns
 * the record; writing upserts row id 1.
 */
export class HeaderRepo {
  constructor(
    private readonly db: DatabaseSync,
    private readonly dates: DateRepo,
  ) {}

  get(): HeaderRecord {
    const row = this.db
      .prepare(
        `SELECT gedcom_version, source_software, source_version, source_name, date_id, language,
           place_form, copyright, file_name, submitter_id, family_file, temple,
           generations_ancestors, generations_descendants, ordinance_process_flag
         FROM header WHERE id = 1`,
      )
      .get() as
      | {
          gedcom_version: string | null;
          source_software: string | null;
          source_version: string | null;
          source_name: string | null;
          date_id: string | null;
          language: string | null;
          place_form: string | null;
          copyright: string | null;
          file_name: string | null;
          submitter_id: string | null;
          family_file: string | null;
          temple: string | null;
          generations_ancestors: number | null;
          generations_descendants: number | null;
          ordinance_process_flag: string | null;
        }
      | undefined;
    if (!row) {
      return {};
    }
    const datesById = this.dates.getMany([row.date_id].filter((id): id is string => id !== null));
    const header: HeaderRecord = {};
    if (row.gedcom_version !== null) {
      header.gedcomVersion = row.gedcom_version;
    }
    if (row.source_software !== null) {
      header.sourceSoftware = row.source_software;
    }
    if (row.source_version !== null) {
      header.sourceVersion = row.source_version;
    }
    if (row.source_name !== null) {
      header.sourceName = row.source_name;
    }
    if (row.date_id !== null) {
      header.date = datesById.get(row.date_id);
    }
    if (row.language !== null) {
      header.language = row.language;
    }
    if (row.place_form !== null) {
      header.placeForm = row.place_form;
    }
    if (row.copyright !== null) {
      header.copyright = row.copyright;
    }
    if (row.file_name !== null) {
      header.fileName = row.file_name;
    }
    if (row.submitter_id !== null) {
      header.submitterId = row.submitter_id;
    }
    if (row.family_file !== null) {
      header.familyFile = row.family_file;
    }
    if (row.temple !== null) {
      header.temple = row.temple;
    }
    if (row.generations_ancestors !== null) {
      header.generationsAncestors = row.generations_ancestors;
    }
    if (row.generations_descendants !== null) {
      header.generationsDescendants = row.generations_descendants;
    }
    if (row.ordinance_process_flag !== null) {
      header.ordinanceProcessFlag = row.ordinance_process_flag;
    }
    return header;
  }

  save(header: HeaderRecord): void {
    const dateId = header.date ? this.dates.upsert(header.date) : null;
    this.db
      .prepare(
        `INSERT INTO header (id, gedcom_version, source_software, source_version, source_name, date_id,
           language, place_form, copyright, file_name, submitter_id, family_file, temple,
           generations_ancestors, generations_descendants, ordinance_process_flag)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           gedcom_version = excluded.gedcom_version, source_software = excluded.source_software,
           source_version = excluded.source_version, source_name = excluded.source_name,
           date_id = excluded.date_id, language = excluded.language, place_form = excluded.place_form,
           copyright = excluded.copyright, file_name = excluded.file_name,
           submitter_id = excluded.submitter_id, family_file = excluded.family_file,
           temple = excluded.temple, generations_ancestors = excluded.generations_ancestors,
           generations_descendants = excluded.generations_descendants,
           ordinance_process_flag = excluded.ordinance_process_flag`,
      )
      .run(
        header.gedcomVersion ?? null,
        header.sourceSoftware ?? null,
        header.sourceVersion ?? null,
        header.sourceName ?? null,
        dateId,
        header.language ?? null,
        header.placeForm ?? null,
        header.copyright ?? null,
        header.fileName ?? null,
        header.submitterId ?? null,
        header.familyFile ?? null,
        header.temple ?? null,
        header.generationsAncestors ?? null,
        header.generationsDescendants ?? null,
        header.ordinanceProcessFlag ?? null,
      );
  }
}
