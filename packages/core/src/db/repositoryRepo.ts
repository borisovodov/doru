import type { DatabaseSync } from 'node:sqlite';
import type { RepositoryRecord } from '../model/types';

/** Repositories (GEDCOM REPO): a name plus an optional address. */
export class RepositoryRepo {
  constructor(private readonly db: DatabaseSync) {}

  insertRepository(repository: RepositoryRecord): void {
    this.db
      .prepare('INSERT INTO repository (id, xref, name, address_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(
        repository.id,
        repository.xref ?? null,
        repository.name,
        repository.addressId ?? null,
        repository.createdAt ?? null,
        repository.updatedAt ?? null,
      );
  }

  updateRepository(repository: RepositoryRecord): void {
    this.db
      .prepare('UPDATE repository SET xref = ?, name = ?, address_id = ?, created_at = ?, updated_at = ? WHERE id = ?')
      .run(
        repository.xref ?? null,
        repository.name,
        repository.addressId ?? null,
        repository.createdAt ?? null,
        repository.updatedAt ?? null,
        repository.id,
      );
  }

  setAddressId(id: string, addressId: string | undefined): void {
    this.db
      .prepare('UPDATE repository SET address_id = ? WHERE id = ? AND address_id IS NULL')
      .run(addressId ?? null, id);
  }

  getRepository(id: string): RepositoryRecord | undefined {
    const row = this.db
      .prepare('SELECT id, xref, name, address_id, created_at, updated_at FROM repository WHERE id = ?')
      .get(id) as
      | {
          id: string;
          xref: string | null;
          name: string;
          address_id: string | null;
          created_at: number | null;
          updated_at: number | null;
        }
      | undefined;
    return row
      ? {
          id: row.id,
          xref: row.xref ?? undefined,
          name: row.name,
          addressId: row.address_id ?? undefined,
          createdAt: row.created_at ?? undefined,
          updatedAt: row.updated_at ?? undefined,
        }
      : undefined;
  }

  listRepositories(): RepositoryRecord[] {
    const rows = this.db
      .prepare('SELECT id, xref, name, address_id, created_at, updated_at FROM repository ORDER BY id')
      .all() as unknown as {
      id: string;
      xref: string | null;
      name: string;
      address_id: string | null;
      created_at: number | null;
      updated_at: number | null;
    }[];
    return rows.map((row) => ({
      id: row.id,
      xref: row.xref ?? undefined,
      name: row.name,
      addressId: row.address_id ?? undefined,
      createdAt: row.created_at ?? undefined,
      updatedAt: row.updated_at ?? undefined,
    }));
  }

  deleteRepository(id: string): boolean {
    return this.db.prepare('DELETE FROM repository WHERE id = ?').run(id).changes > 0;
  }
}
